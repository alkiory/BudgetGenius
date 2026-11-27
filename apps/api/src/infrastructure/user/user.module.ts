import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@domain/user/user.entity';
import { UserController } from '@adapters/user/http/user.controller';
import { UserService } from '@application/user/user.service';
import { LoggingService } from '@infrastructure/log/logger.service';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';
import { UserSettingsModule } from './user-settings.module';
import { RedisService } from '@infrastructure/config/redis.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), UserSettingsModule],
  controllers: [UserController],
  providers: [
    UserService,
    UserRepositoryImpl,
    LoggingService,
    // Used to revoke the stored refresh token on a password change.
    RedisService,
  ],
  exports: [UserService, UserRepositoryImpl],
})
export class UserModule {}
