import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PrimaryGeneratedColumn } from 'typeorm';

export class UserDto {
  @PrimaryGeneratedColumn()
  id: number;

  @IsString()
  @IsOptional()
  name: string;

  @IsString()
  @IsOptional()
  surname: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  password: string;

  @IsString()
  authProvider: 'email' | 'google';

  @IsString()
  role: string;

  @IsString()
  @IsOptional()
  refreshToken: string;

  @IsBoolean()
  isPremium: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}
