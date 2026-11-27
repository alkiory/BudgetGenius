import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @IsEmail()
  readonly email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  readonly password: string;

  @IsString()
  authProvider: 'email' | 'google';

  /**
   * Signup only ever creates a regular account. The operator role is granted
   * by the server from `SUPERADMIN_EMAIL` (boot seeder and sign-in), never by
   * the client: this field used to accept any string, so a crafted POST could
   * mint a second superadmin.
   */
  @IsOptional()
  @IsIn(['user'], { message: 'role must be "user"' })
  readonly role?: 'user';

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @CreateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
