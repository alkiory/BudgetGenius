import {
  BadRequestException,
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
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getApps, initializeApp } from 'firebase/app';

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

  async login(email: string, password: string) {
    try {
      // 1. Buscar el usuario en la DB local primero
      const user = await this.userRepository.findByEmail(email);

      if (!user) {
        throw new UnauthorizedException(
          '⚠️ Usuario no encontrado en la base de datos',
        );
      }

      // 2. VALIDACIÓN DE CONTRASEÑA (MODO LOCAL)
      // Si no usas Firebase, debes comparar el hash.
      // Si usas Firebase siempre, este paso falla porque el usuario no existe en la nube.

      // --- Lógica para saltar Firebase en desarrollo ---
      const useFirebase =
        this.configService.get<string>('NODE_ENV') === 'production';

      if (useFirebase) {
        if (!getApps().length) {
          initializeApp({
            apiKey: this.configService.get<string>('FIREBASE_API_KEY'),
            authDomain: this.configService.get<string>('FIREBASE_AUTH_DOMAIN'),
            projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
            storageBucket: this.configService.get<string>(
              'FIREBASE_STORAGE_BUCKET',
            ),
            messagingSenderId: this.configService.get<string>(
              'FIREBASE_MESSAGING_SENDER_ID',
            ),
            appId: this.configService.get<string>('FIREBASE_APP_ID'),
            measurementId: this.configService.get<string>(
              'FIREBASE_MEASURENT_ID',
            ),
          });
        }
        const auth = getAuth();
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Simulación o validación bcrypt (si guardas passwords en tu DB)
        // const isMatch = await bcrypt.compare(password, user.password);
        // if (!isMatch) throw new UnauthorizedException('🔒 Contraseña incorrecta');

        this.logger.log(
          `Modo local: Saltando validación de Firebase para ${email}`,
        );
      }

      // 3. Generar tokens (JWT)
      const userData = { id: user.id, email: user.email, role: user.role };
      const accessToken = this.jwtService.sign(userData, { expiresIn: '1h' });
      const refreshToken = this.jwtService.sign(userData, { expiresIn: '7d' });

      // 4. Guardar en Redis
      await this.redisService.set(
        `refreshToken:${user.id}`,
        refreshToken,
        604800,
      );

      return { accessToken, refreshToken, user };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;

      // Errores de Firebase
      if (error.code?.includes('auth/')) {
        throw new UnauthorizedException(
          '🔒 Credenciales inválidas en Firebase',
        );
      }

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
        isPremium: false,
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
    this.logger.log(
      `🔗 Link to reset password: ${this.configService.get<string>(
        'FRONTEND_URL',
      )}/auth/reset-password?token=${token}`,
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
