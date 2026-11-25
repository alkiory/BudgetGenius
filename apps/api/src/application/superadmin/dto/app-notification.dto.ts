import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  AppNotificationAudience,
  AppNotificationLevel,
} from '@domain/superadmin/app-notification.entity';

const LEVELS: AppNotificationLevel[] = [
  'info',
  'success',
  'warning',
  'critical',
];
const AUDIENCES: AppNotificationAudience[] = ['all', 'free', 'premium'];

export class CreateAppNotificationDto {
  @IsString()
  @Length(3, 140)
  title: string;

  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  body: string;

  @IsOptional()
  @IsIn(LEVELS)
  level?: AppNotificationLevel;

  @IsOptional()
  @IsIn(AUDIENCES)
  audience?: AppNotificationAudience;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateAppNotificationDto extends PartialType(
  CreateAppNotificationDto,
) {}
