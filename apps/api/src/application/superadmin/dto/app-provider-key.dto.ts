import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAppProviderKeyDto {
  @IsString()
  @Length(2, 80)
  label: string;

  @IsString()
  @MinLength(8)
  @MaxLength(512)
  key: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  provider?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAppProviderKeyDto extends PartialType(
  CreateAppProviderKeyDto,
) {}
