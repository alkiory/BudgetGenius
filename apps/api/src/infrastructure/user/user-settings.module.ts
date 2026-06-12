import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggingService } from '@infrastructure/log/logger.service';
import { UserSettingsController } from '@adapters/user/http/user-settings.controller';
import { UserSettingsRepository } from '@adapters/user/persistence/user-settings.repository';
import { UserSettingsService } from '@application/user/user-settings.service';
import { UserSettings } from '@domain/user/user-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserSettings])],
  controllers: [UserSettingsController],
  providers: [UserSettingsService, LoggingService, UserSettingsRepository],
  exports: [UserSettingsService, UserSettingsRepository],
})
export class UserSettingsModule {}
