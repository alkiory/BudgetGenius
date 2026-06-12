import { IsNumber, IsOptional, IsString } from 'class-validator';
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
}
