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
import { UserSettingsService } from '@application/user/user-settings.service';

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
    private readonly userSettingsService: UserSettingsService,
  ) { }

  findOne(email: string) {
    return this.userRepository.findByEmail(email);
  }

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

    await this.eagerCreateUserSettingsRow(newUser.id, newUser.email, 'email');

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
    const hashedToken = await bcrypt.hash(refreshToken, BCRYPT_COST);
    await this.userRepository.updateToken(id, hashedToken);
  }

  private loginAttemptsKey(email: string): string {
    // Normalize so 'User@x.com' and 'user@x.com' share the same bucket.
    return `login:attempts:${email.trim().toLowerCase()}`;
  }

  async login(email: string, password: string) {
    try {
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
    // Production-hot-fix (2026-07-02): decoupled the OAuth contract
    // from the pre-onboarding settings seed. The seed used to sit
    // inside the TypeORM transaction's try/catch, after commit;
    // that placement risked masking the original commit with a
    // TypeORM "transaction is not active" error if rollback ever
    // fired on a committed runner. The seed now runs AFTER release,
    // and rollbackTransaction() and release() are both guarded so
    // a TypeORM internals throw cannot clobber the auth response.
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let isNewUser = false;
    let finalUser: User | undefined;

    try {
      // Buscar usuario existente dentro de la transacción
      const existingUser = await queryRunner.manager.findOne(User, {
        where: { email: profile.email },
      });

      if (existingUser) {
        finalUser = existingUser;
      } else {
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
        isNewUser = true;
        finalUser = newUser;
      }

      // Confirmar la transacción
      await queryRunner.commitTransaction();
    } catch (error) {
      // Solo rollback si la transacción sigue activa; un rollback
      // sobre transacción ya comprometida lanza un QueryFailedError
      // de TypeORM que enmascararía el error real.
      if (queryRunner.isTransactionActive) {
        try {
          await queryRunner.rollbackTransaction();
        } catch (rollbackErr) {
          this.logger.warn(
            `🔁 rollbackTransaction failed during Google OAuth: ${
              (rollbackErr as Error).message
            }. Original error will still propagate.`,
          );
        }
      }
      this.logger.error('Google OAuth failed', error.stack);
      throw new UnauthorizedException('Google authentication failed');
    } finally {
      // Liberar el QueryRunner. Same defense-in-depth pattern: never
      // let TypeORM release() clobber the auth response.
      try {
        await queryRunner.release();
      } catch (releaseErr) {
        this.logger.warn(
          `🔁 QueryRunner release failed during Google OAuth: ${
            (releaseErr as Error).message
          }. Continuing.`,
        );
      }
    }

    // Eager-create pre-onboarding settings row OUTSIDE the transaction
    // lifecycle. eagerCreateUserSettingsRow has its own internal
    // try/catch so a DI hiccup on the APK side can never break sign-in.
    if (isNewUser && finalUser) {
      await this.eagerCreateUserSettingsRow(
        finalUser.id,
        finalUser.email,
        'google',
      );
    }

    return finalUser!;
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

  /**
   * Eager-create the user_settings row with `hasCompletedOnboarding=false`
   * during signup (email or Google OAuth). The old design relied on a
   * lazy path — the row was created on the first GET /user-settings
   * call — but that left a window where `protected-route.tsx` evaluated
   * `settings?.hasCompletedOnboarding === false` against `settings ===
   * undefined`, slipping a fresh user past the gate onto
   * `/app/dashboard` with hardcoded defaults instead of the wizard.
   *
   * Best-effort: a transient failure here only delays the row creation
   * by one /user-settings round-trip (the lazy path retries). It must
   * NEVER break the auth response — login is the contract, onboarding
   * is a follow-up that can be deferred. The `'pre-onboarding'` log
   * wording is intentional: we just created the row in the
   * wizard-pending state, we did not finish onboarding the user.
   *
   * @param userId newly-created user id (NOT the JWT subject)
   * @param email logging-only; helps grep for "Initialized" per source
   * @param source 'email' | 'google' — tag distinguishing the two paths
   * so a grep can correlate to the calling signup flow.
   */
  private async eagerCreateUserSettingsRow(
    userId: number,
    email: string,
    source: 'email' | 'google',
  ): Promise<void> {
    try {
      await this.userSettingsService.getOrCreateSettings(userId);
      this.logger.log(
        `⚙️ Initialized pre-onboarding user_settings row for ${source} user ${email}`,
      );
    } catch (settingsErr) {
      this.logger.warn(
        `⚠️ Could not eagerly create user_settings for ${source} user ${email}: ${(settingsErr as Error).message
        }. Lazy fallback will still work on first GET /user-settings.`,
      );
    }
  }

  /**
   * Deletes the refresh token from Redis so it cannot be reused.
   * Called on logout to ensure a stale cookie cannot silently re-auth
   * the user (particularly important in Capacitor WebViews where cookie
   * clearing may not propagate immediately).
   */
  async invalidateRefreshToken(userId: number): Promise<void> {
    await this.redisService.delete(`refreshToken:${userId}`);
    this.logger.log(`🗑️ Refresh token invalidated for user ${userId}`);
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
    const jitter =
      RESET_TIMING_JITTER_MS_LO +
      Math.floor(
        Math.random() * (RESET_TIMING_JITTER_MS_HI - RESET_TIMING_JITTER_MS_LO),
      );
    await sleep(jitter);

    const user = await this.userRepository.findByEmail(dto.email);

    if (!user || user.authProvider !== 'email' || !user.password) {
      const reason = !user
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

    const rawFrontendUrl = this.configService.get<string>('FRONTEND_URL');

    if (!rawFrontendUrl) {
      this.logger.error(
        `🚨 FRONTEND_URL env var is missing while handling reset for ${dto.email}`,
      );
      throw new InternalServerErrorException(
        'Reset link cannot be generated at this time.',
      );
    }

    // FRONTEND_URL may carry multiple comma-separated origins; we use
    // the first (primary) to build the user-facing reset link.
    const primaryFrontendUrl = rawFrontendUrl
      .split(',')[0]
      .trim()
      .replace(/\/+$/, '');

    if (!/^https?:\/\//.test(primaryFrontendUrl)) {
      this.logger.error(
        `🚨 FRONTEND_URL is malformed ("${primaryFrontendUrl}") while handling reset for ${dto.email}`,
      );
      throw new InternalServerErrorException(
        'Reset link cannot be generated at this time.',
      );
    }

    const token = randomBytes(32).toString('hex');
    await this.passwordResetRepository.saveToken(user.email, token);

    const resetUrl = `${primaryFrontendUrl}/auth/reset-password?token=${token}`;

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
          `Could not delete expired reset token ${resetToken.id}: ${(cleanupErr as Error).message
          }`,
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
