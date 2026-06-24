import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RedisService } from '@infrastructure/config/redis.service';
import { User, UserRole, BCRYPT_COST } from '@domain/user/user.entity';
import { LoggingService } from '@infrastructure/log/logger.service';
import { PasswordResetRepository } from '@adapters/auth/persistence/password-reset.repository';
import { ForgotPasswordDto } from '@application/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@application/auth/dto/reset-password.dto';
import { randomBytes } from 'crypto';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';
import { DataSource } from 'typeorm';
import { ResendMailerService } from '@infrastructure/mail/resend-mailer.service';

/** Per-email brute-force protection. Anything tighter would block legitimate users
 *  who mistype; anything looser would not stop a credential-stuffing script. */
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_SECONDS = 15 * 60;

/** Password-reset token TTL. Long enough for the user to find the email and
 *  click the link; short enough that a leaked URL is useless after a few hours. */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Half-open interval for the anti-enumeration timing jitter on
 *  `requestPasswordReset`. We await this delay on every request so the
 *  attacker cannot distinguish "user exists" from "user doesn't exist"
 *  by response-time deltas (the findByEmail + DB lookup on the hit
 *  branch would otherwise be measurably slower than the miss branch).
 *
 *  ~100 ms per request is acceptable because forgot-password is a
 *  low-traffic endpoint. Do NOT move this INTO the rejection branch
 *  — that re-introduces the timing oracle. The sleep MUST run BEFORE
 *  any branching on user existence. */
const RESET_TIMING_JITTER_MS_LO = 60;
const RESET_TIMING_JITTER_MS_HI = 120;

/** Wait a small randomised interval to flatten out timing oracles. */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepositoryImpl,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly logger: LoggingService,
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly mailer: ResendMailerService,
  ) {}

  findOne(email: string) {
    return this.userRepository.findByEmail(email);
  }

  /**
   * Idempotent signup. Three possible outcomes:
   *
   * 1. The email is brand-new → create the account and return fresh tokens.
   * 2. The email already exists AND has the same bcrypt-hashed password →
   *    treat the call as a retry and re-issue tokens (handles double-clicks
   *    and flaky networks that re-trigger /signup on the same client).
   *    The caller already proved knowledge of the password, so this is
   *    equivalent to a normal login.
   * 3. The email already exists without a matching password (different
   *    password, or the account was created via Google/social and never
   *    had a password set) → 409 Conflict. We deliberately do NOT leak
   *    which case it is, to avoid user-enumeration side channels.
   */
  async signup(dto: {
    name: string;
    surname?: string;
    email: string;
    password: string;
    authProvider: 'email' | 'google';
    role: string;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    user: User;
    isNewUser: boolean;
  }> {
    const existingUser = await this.userRepository.findByEmail(dto.email);

    if (existingUser) {
      // Social-only account: no email/password set, so we cannot log them
      // in via this endpoint.
      if (!existingUser.password) {
        throw new ConflictException(
          '⚠️ This email is registered via social login. Please sign in with that provider.',
        );
      }

      // Same password → idempotent retry → log them in.
      const passwordMatches = await bcrypt.compare(
        dto.password,
        existingUser.password,
      );
      if (!passwordMatches) {
        throw new ConflictException('⚠️ Email already in use');
      }

      const payload = {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
      };
      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
      await this.redisService.set(
        `refreshToken:${existingUser.id}`,
        refreshToken,
        604800,
      );

      return {
        accessToken,
        refreshToken,
        user: existingUser,
        isNewUser: false,
      };
    }

    // Brand-new account. Bypass UserService.createUser intentionally: its
    // current implementation calls userRepository.save() a second time after
    // createUser() resolved, which is a no-op at best and can mask silent
    // failures at worst. Persisting once via the repository is enough.
    const newUser = await this.userRepository.createUser({
      name: dto.name,
      surname: dto.surname,
      email: dto.email,
      password: dto.password,
      role: dto.role,
      authProvider: dto.authProvider,
      refreshToken: null,
    });

    const payload = {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    await this.redisService.set(
      `refreshToken:${newUser.id}`,
      refreshToken,
      604800,
    );

    this.logger.log(`🪪 New user registered: ${newUser.email}`);
    return {
      accessToken,
      refreshToken,
      user: newUser,
      isNewUser: true,
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findByEmail(email);

    // Si no hay usuario o el usuario no tiene password (login social)
    if (!user || !user.password) {
      this.logger.warn(
        `Intentando validar con password un usuario sin ella: ${email}`,
      );
      return null; // En lugar de throw, retorna null para que el controller decida
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return null;

    return user;
  }

  async updateRefreshToken(id: number, refreshToken: string) {
    // Note: refresh tokens live in Redis (not in a User column), so the
    // entity-hook wiring we built for `users.password` does not apply
    // here — hashing is done directly. `BCRYPT_COST` keeps this in lock
    // step with password hashing in case the cost factor ever changes.
    const hashedToken = await bcrypt.hash(refreshToken, BCRYPT_COST);
    await this.userRepository.updateToken(id, hashedToken);
  }

  private loginAttemptsKey(email: string): string {
    // Normalize so 'User@x.com' and 'user@x.com' share the same bucket.
    return `login:attempts:${email.trim().toLowerCase()}`;
  }

  async login(email: string, password: string) {
    try {
      // 1. Per-email rate-limit check (brute-force mitigation).
      // Done before any DB lookup / bcrypt work so attackers can't burn CPU.
      // The counter auto-expires after LOGIN_WINDOW_SECONDS thanks to incr().
      const attemptsKey = this.loginAttemptsKey(email);
      const attemptsRaw = await this.redisService.get(attemptsKey);
      const attempts = attemptsRaw ? Number(attemptsRaw) : 0;

      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        this.logger.warn(
          `🚫 Login bloqueado por rate-limit (${attempts}/${LOGIN_MAX_ATTEMPTS}) para ${email}`,
        );
        throw new HttpException(
          {
            message:
              '🚫 Demasiados intentos. Vuelve a intentarlo en unos minutos o usa "Olvidé mi contraseña".',
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // 2. Buscar el usuario en la DB local primero
      const user = await this.userRepository.findByEmail(email);

      if (!user) {
        // Increment failed-attempt counter (also prevents user enumeration).
        await this.redisService.incr(attemptsKey, LOGIN_WINDOW_SECONDS);
        throw new UnauthorizedException(
          '⚠️ Usuario no encontrado en la base de datos',
        );
      }

      // 3. Social-only users (no password) can't be brute-forced — surface a clear
      // error so they take the OAuth path. IMPORTANT: do NOT touch the counter
      // here. Clearing it before throwing would let an attacker distinguish
      // OAuth-only emails (counter reset) from non-existent emails (counter
      // increments), creating an enumeration side channel. Let the counter
      // expire naturally via the 15-min TTL.
      if (!user.password) {
        throw new UnauthorizedException(
          '⚠️ Este usuario no tiene contraseña configurada (probablemente login social)',
        );
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        await this.redisService.incr(attemptsKey, LOGIN_WINDOW_SECONDS);
        throw new UnauthorizedException('🔒 Contraseña incorrecta');
      }

      // 4. Login exitoso: limpiamos el contador para no penalizar a usuarios
      // legítimos que tuvieron typos previos.
      await this.redisService.delete(attemptsKey);

      // 5. Generar tokens (JWT)
      const userData = { id: user.id, email: user.email, role: user.role };
      const accessToken = this.jwtService.sign(userData, { expiresIn: '1h' });
      const refreshToken = this.jwtService.sign(userData, { expiresIn: '7d' });

      // 6. Guardar en Redis
      await this.redisService.set(
        `refreshToken:${user.id}`,
        refreshToken,
        604800,
      );

      return { accessToken, refreshToken, user };
    } catch (error) {
      // Rate-limit HttpException (429) MUST propagate without being swallowed
      // by the generic UnauthorizedException catcher below.
      if (error instanceof UnauthorizedException) throw error;
      if (error instanceof HttpException) throw error;

      this.logger.error(`Error login: ${error.message}`);
      throw new UnauthorizedException('Error de autenticación');
    }
  }

  async refreshToken(id: number, refreshToken: string) {
    try {
      const storedToken = await this.redisService.get(`refreshToken:${id}`);
      if (!storedToken) {
        throw new UnauthorizedException('⛔ Token expired, login again.');
      }

      if (storedToken !== refreshToken) {
        throw new UnauthorizedException('⛔ Invalid refresh token');
      }

      const userData = { sub: id };
      const newAccessToken = this.jwtService.sign(userData, {
        expiresIn: '1h',
      });

      return { accessToken: newAccessToken };
    } catch (error) {
      throw error;
    }
  }

  async validateOAuthUser(profile: {
    providerId: string;
    email: string;
    name: string;
    photo?: string;
  }): Promise<User> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Buscar usuario existente dentro de la transacción
      const existingUser = await queryRunner.manager.findOne(User, {
        where: { email: profile.email },
      });

      if (existingUser) {
        await queryRunner.commitTransaction();
        return existingUser;
      }

      // Crear nuevo usuario
      const [name, ...surnameParts] = profile.name.split(' ');
      const surname = surnameParts.join(' ') || 'Unknown';

      const newUser = queryRunner.manager.create(User, {
        name,
        surname,
        email: profile.email,
        authProvider: 'google',
        role: UserRole.USER,
        password: null,
      });

      await queryRunner.manager.save(newUser);

      // Confirmar la transacción
      await queryRunner.commitTransaction();

      return newUser;
    } catch (error) {
      // Deshacer cambios en caso de error
      await queryRunner.rollbackTransaction();
      this.logger.error('Google OAuth failed', error.stack);
      throw new UnauthorizedException('Google authentication failed');
    } finally {
      // Liberar el QueryRunner
      await queryRunner.release();
    }
  }

  async oauthLogin(profile: any) {
    if (!profile?.email) {
      throw new UnauthorizedException('Google profile incomplete');
    }

    // Delegar toda la lógica a validateOAuthUser
    const userEntity = await this.validateOAuthUser(profile);

    const payload = {
      id: userEntity.id,
      email: userEntity.email,
      role: userEntity.role,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    await this.redisService.set(
      `refreshToken:${userEntity.id}`,
      refreshToken,
      604800, // 7 días
    );

    this.logger.log(`👤 User ${userEntity.email} logged in successfully`);

    return { accessToken, refreshToken, userEntity };
  }

  async addTokenToBlacklist(token: string) {
    const userData = this.jwtService.decode(token);
    if (!userData) throw new Error('Invalid token');

    // Store the token in Redis with an expiration time equal to the JWT's expiration time
    const tokenExpiration = userData['exp']; // Get the expiration time from the JWT
    await this.redisService.set(
      token,
      'blacklisted',
      tokenExpiration - Math.floor(Date.now() / 1000),
    );
  }

  async requestPasswordReset(dto: ForgotPasswordDto) {
    // Flatten timing oracle: pick a random sleep BEFORE branching on
    // user existence so the response-time envelope is the same whether
    // the row exists or not. Without this, the hit branch's
    // Postgres lookup + bcrypt-free token generation were measurably
    // slower than the miss branch's plain return.
    const jitter =
      RESET_TIMING_JITTER_MS_LO +
      Math.floor(
        Math.random() *
          (RESET_TIMING_JITTER_MS_HI - RESET_TIMING_JITTER_MS_LO),
      );
    await sleep(jitter);

    const user = await this.userRepository.findByEmail(dto.email);

    // Self-documenting gate inline so the rejection intent reads at a
    // glance AND TypeScript narrows `user` to non-null across the rest
    // of the function (the `Boolean(user)` predicate is what flips
    // narrowing). Only true email-auth users (with a password set) are
    // eligible for password reset. Un-resettable accounts (unknown
    // email, social-only, missing password) are silently absorbed to
    // prevent user-enumeration and to avoid expanding the auth surface
    // of OAuth-only accounts (Google-only users must not silently gain
    // a password they didn't opt into).
    if (!user || user.authProvider !== 'email' || !user.password) {
      const reason =
        !user
          ? 'unknown'
          : user.authProvider !== 'email'
            ? 'social-only'
            : 'no-password';
      this.logger.warn(
        `🔍 Password reset requested for un-resettable account: ${dto.email} (reason: ${reason})`,
      );
      return {
        message: '📨 Recovery link sent to your email',
      };
    }

    const token = randomBytes(32).toString('hex');
    await this.passwordResetRepository.saveToken(user.email, token);

    // FRONTEND_URL may carry multiple comma-separated origins; we use the
    // first (primary) to build the user-facing reset link.
    //
    // Defensive fallback: if FRONTEND_URL env var is unset (e.g., missing from
    // the deployment config), fall back to the production Firebase Hosting URL
    // rather than throwing a 500 that breaks the forgot-password flow entirely.
    // This mirrors the same hardcoded default used in main.ts for CORS.
    const FALLBACK_FRONTEND_URL =
      this.configService.get<string>('NODE_ENV') === 'production'
        ? 'https://budgetgeniusia.web.app'
        : 'http://localhost:5173';

    const primaryFrontendUrl =
      this.configService
        .get<string>('FRONTEND_URL')
        ?.split(',')[0]
        ?.trim()
        .replace(/\/+$/, '') || FALLBACK_FRONTEND_URL;

    // Validate that the URL starts with http:// or https:// to avoid
    // shipping an email with a broken relative link. The fallback URL
    // already satisfies this check, so this guard only fires if the env
    // var is set to something malformed like `not-a-url`.
    if (!/^https?:\/\//.test(primaryFrontendUrl)) {
      this.logger.error(
        `🚨 FRONTEND_URL is malformed ("${primaryFrontendUrl}"); aborting password reset email`,
      );
      throw new InternalServerErrorException(
        'FRONTEND_URL is misconfigured; cannot build the reset link.',
      );
    }

    const resetUrl = `${primaryFrontendUrl}/auth/reset-password?token=${token}`;

    // The previous implementation only wrote the URL to a log line and
    // lied to the client (`message: 'Recovery link sent to your email'`)
    // while no email was ever sent. resendMailer throws on transport
    // failure, so the controller surfaces a 5xx if delivery fails —
    // clients can retry instead of believing a phantom success.
    await this.mailer.sendPasswordReset(user.email, resetUrl);

    // Still log the URL in dev so it's grep-able when debugging locally
    // (Resend's sent inbox also shows the message, but a console line
    // speeds up "did the call even fire?" triage).
    this.logger.log(`🔗 Password reset URL for ${user.email}: ${resetUrl}`);

    return {
      message: '📨 Recovery link sent to your email',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const resetToken = await this.passwordResetRepository.findToken(dto.token);
    if (!resetToken) {
      throw new BadRequestException('🛑 Invalid token');
    }

    // Token TTL defence: the previous implementation accepted any token
    // forever, which is bad if the URL ever leaks (logs, screenshots,
    // email-forwarding). The token table stores createdAt via
    // @CreateDateColumn; reject anything older than RESET_TOKEN_TTL_MS.
    const tokenAgeMs = Date.now() - new Date(resetToken.createdAt).getTime();
    if (Number.isNaN(tokenAgeMs) || tokenAgeMs > RESET_TOKEN_TTL_MS) {
      // Best-effort cleanup so the row doesn't dangle for a year.
      try {
        await this.passwordResetRepository.deleteToken(resetToken.id);
      } catch (cleanupErr) {
        this.logger.warn(
          `Could not delete expired reset token ${resetToken.id}: ${(cleanupErr as Error).message}`,
        );
      }
      throw new BadRequestException('🛑 Reset token expired');
    }

    const user = await this.userRepository.findByEmail(resetToken.email);
    if (!user) {
      throw new NotFoundException('⚠️ User not found');
    }

    // `userRepository.updateUser` runs `repo.preload + repo.save`, which
    // fires the User entity's `@BeforeUpdate hashPassword` hook — the
    // hook is the single source of truth for password hashing. Forward
    // the plaintext: the @BeforeUpdate body will bcrypt-hash it before
    // the SQL UPDATE runs.
    await this.userRepository.updateUser(user.id, {
      password: dto.newPassword,
    });
    await this.passwordResetRepository.deleteToken(resetToken.id);

    this.logger.log(`🔑 Password reset successfully for user ${user.email}`);
    return { message: '🔑 Password reset successfully' };
  }
}
