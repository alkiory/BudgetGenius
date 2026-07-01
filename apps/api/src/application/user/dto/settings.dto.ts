import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

export class UserSettingsDto {
  @PrimaryGeneratedColumn()
  id: number;

  @IsNumber()
  userId: number;

  @IsString({ message: 'Timezone must be a string, e.g. UTC' })
  timezone: string;

  @IsString({ message: 'Currency must be a string, e.g. USD' })
  currency: string;

  @IsString({ message: 'Locale must be a string e.g. en-US' })
  locale: string;

  /**
   * Android APK audit, 2026-06: surfaced on GET /user-settings so the
   * client knows whether to send the user through the first-login
   * onboarding wizard. See apps/api/src/migrations/1800000000005-
   * AddHasCompletedOnboarding.ts for the column origin.
   */
  @IsBoolean()
  hasCompletedOnboarding: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @CreateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}

export class UserSettingsUpdateDto {
  @IsString({ message: 'Timezone must be a string, e.g. UTC' })
  @IsOptional()
  timezone?: string;

  @IsString({ message: 'Currency must be a string, e.g. USD' })
  @IsOptional()
  currency?: string;

  @IsString({ message: 'Locale must be a string e.g. en-US' })
  @IsOptional()
  locale?: string;

  /**
   * Android APK audit, 2026-06: onboarding wizard flips this to
   * `true` after the user confirms timezone / currency / language.
   * Optional so existing partial-update callers
   * (account-settings.tsx, language-switcher.tsx) don't have to
   * pass it.
   */
  @IsBoolean()
  @IsOptional()
  hasCompletedOnboarding?: boolean;
}
