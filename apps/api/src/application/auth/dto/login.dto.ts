import { IsNotEmpty, IsEmail, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  // Trim BEFORE `@IsEmail`: a copy-pasted address arrives as
  // `" user@x.com "`, which is a valid mailbox with invalid whitespace. The
  // global ValidationPipe runs with `transform: true`, so this decorator is
  // applied on the way in; casing is canonicalised later by the domain
  // (`normalizeEmail`).
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @IsEmail()
  readonly email: string;

  @IsNotEmpty()
  @IsString()
  readonly password: string;
}
