import { IsNotEmpty, IsString, IsEmail, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { CreateDateColumn } from 'typeorm';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  readonly name: string;

  @IsString()
  readonly surname: string;

  // Same boundary rule as `LoginDto`: trim before validating, so a padded
  // address is accepted here and stored canonically by the repository.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
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
