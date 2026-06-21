import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RedisService } from '@infrastructure/config/redis.service';
import { User, UserRole } from '@domain/user/user.entity';
import { LoggingService } from '@infrastructure/log/logger.service';
import { PasswordResetRepository } from '@adapters/auth/persistence/password-reset.repository';
import { ForgotPasswordDto } from '@application/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@application/auth/dto/reset-password.dto';
import { randomBytes } from 'crypto';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';
import { DataSource } from 'typeorm';

/** Per-email brute-force protection. Anything tighter would block legitimate users
 *  who mistype; anything looser would not stop a credential-stuffing script. */
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_SECONDS = 15 * 60;

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
  ) {}

  findOne(email: string) {
    return this.userRepository.findByEmail(email);
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
    const hashedToken = await bcrypt.hash(refreshToken, 10);
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
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new NotFoundException('⚠️ User not found');
    }

    const token = randomBytes(32).toString('hex');
    await this.passwordResetRepository.saveToken(dto.email, token);

    // Aquí enviarías el correo con el enlace para restablecer la contraseña.
    // FRONTEND_URL puede contener varios orígenes separados por coma; usamos
    // el primero (el principal) para construir el enlace de recuperación.
    const primaryFrontendUrl =
      this.configService
        .get<string>('FRONTEND_URL')
        ?.split(',')[0]
        ?.trim()
        .replace(/\/+$/, '') ?? '';

    this.logger.log(
      `🔗 Link to reset password: ${primaryFrontendUrl}/auth/reset-password?token=${token}`,
    );

    return {
      message: '📨 Recovery link sent to your email',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const resetToken = await this.passwordResetRepository.findToken(dto.token);
    if (!resetToken) {
      throw new BadRequestException('🛑 Invalid token');
    }

    const user = await this.userRepository.findByEmail(resetToken.email);
    if (!user) {
      throw new NotFoundException('⚠️ User not found');
    }

    await this.userRepository.updateUser(user.id, {
      ...user,
      password: user.password,
    });
    await this.passwordResetRepository.deleteToken(resetToken.id);

    this.logger.log(`🔑 Password reset successfully for user ${user.email}`);
    return { message: '🔑 Password reset successfully' };
  }
}
