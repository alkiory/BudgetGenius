import { IsOptional, IsString, MaxLength } from 'class-validator';
import { UserDto } from './user.dto';

/**
 * Fields a signed-in account may change about itself.
 *
 * The endpoint used to take `Partial<UserDto>`, which the global
 * `ValidationPipe` cannot validate at all — a TypeScript type alias erases to
 * `Object` at runtime, so the pipe saw no metatype and skipped the body. A
 * request could therefore write any column, including `role`, `email`,
 * `authProvider` and `refreshToken`; setting `role` to `superadmin` and signing
 * in again minted an operator token.
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  surname?: string;
}

/**
 * Builds the update payload from the whitelisted DTO only.
 *
 * Doing this explicitly (instead of spreading the body) keeps the boundary
 * correct even if this DTO later grows a field that must not reach the
 * repository.
 */
export function profilePatch(dto: UpdateUserDto): Partial<UserDto> {
  const patch: Partial<UserDto> = { updatedAt: new Date() };
  if (dto.name !== undefined) patch.name = dto.name;
  if (dto.surname !== undefined) patch.surname = dto.surname;
  return patch;
}
