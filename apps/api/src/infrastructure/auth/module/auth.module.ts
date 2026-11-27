import { Module } from '@nestjs/common';
import { AuthService } from '@application/auth/auth.service';
import { AuthController } from '@adapters/auth/http/auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from '@infrastructure/user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@domain/user/user.entity';
import { RedisService } from '@infrastructure/config/redis.service';
import { TokenEpochService } from '@application/auth/token-epoch.service';
import { GoogleStrategy } from '../google.strategy';
import { JwtStrategy } from '../../config/strategy/jwt.strategy';
import { LoggingService } from '@infrastructure/log/logger.service';
import { PasswordResetToken } from '@domain/auth/password-reset.entity';
import { PasswordResetRepository } from '@adapters/auth/persistence/password-reset.repository';
import { CookieService } from '@infrastructure/config/cookie.service';
import { ResendMailerService } from '@infrastructure/mail/resend-mailer.service';
import { UserSettingsModule } from '@infrastructure/user/user-settings.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PassportModule.register({ defaultStrategy: 'google' }),
    UserModule,
    UserSettingsModule,
    TypeOrmModule.forFeature([User, PasswordResetToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  providers: [
    PasswordResetRepository,
    AuthService,
    JwtStrategy,
    RedisService,
    TokenEpochService,
    GoogleStrategy,
    LoggingService,
    CookieService,
    ResendMailerService,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
