import { IsNotEmpty, IsString, IsEmail, MinLength } from 'class-validator';
import { CreateDateColumn } from 'typeorm';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  readonly name: string;

  @IsString()
  readonly surname: string;

  @IsNotEmpty()
  @IsEmail()
  readonly email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  readonly password: string;

  @IsString()
  authProvider: 'email' | 'google';

  @IsString()
  role: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @CreateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
