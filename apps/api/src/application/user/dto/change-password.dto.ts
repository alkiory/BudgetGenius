import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Re-authentication plus the new credential.
 *
 * The current password is required so a hijacked session cannot lock the owner
 * out of their own account, and the new one is bounded like the signup
 * password. The profile endpoint deliberately does not accept `password`: a
 * credential is not a profile field.
 */
export class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  newPassword: string;
}
