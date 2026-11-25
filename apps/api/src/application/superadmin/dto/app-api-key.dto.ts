import { IsArray, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateAppApiKeyDto {
  @IsString()
  @Length(2, 100)
  name: string;

  /** Free-form capability labels, e.g. `modules:read`, `usage:read`. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  scopes?: string[];
}
