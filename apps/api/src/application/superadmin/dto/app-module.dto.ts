import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  AppModuleKind,
  AppModuleStatus,
} from '@domain/superadmin/app-module.entity';

const STATUSES: AppModuleStatus[] = ['active', 'beta', 'disabled'];
const KINDS: AppModuleKind[] = ['module', 'component', 'integration'];

export class CreateAppModuleDto {
  /** Machine key: lowercase, digits and dashes (`reports-monthly`). */
  @IsString()
  @Length(2, 80)
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message: 'key must be lowercase letters, digits or dashes',
  })
  key: string;

  @IsString()
  @Length(2, 120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

  /** Module, reusable UI component or external integration. */
  @IsOptional()
  @IsIn(KINDS)
  kind?: AppModuleKind;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  /**
   * Key of the module this entry belongs to (`cards` for `card-type`).
   * Empty string clears the relation.
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^([a-z0-9][a-z0-9-]*)?$/, {
    message: 'parentKey must be lowercase letters, digits or dashes',
  })
  parentKey?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: AppModuleStatus;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  version?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isCore?: boolean;
}

export class UpdateAppModuleDto extends PartialType(CreateAppModuleDto) {}
