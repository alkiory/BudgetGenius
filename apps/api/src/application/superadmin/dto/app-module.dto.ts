import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  AppModuleKind,
  AppModuleStatus,
} from '@domain/superadmin/app-module.entity';

const STATUSES: AppModuleStatus[] = ['active', 'beta', 'disabled'];
const KINDS: AppModuleKind[] = [
  'module',
  'component',
  'integration',
  'page',
  'tab',
];

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

/** One placed block; `props` is validated against the block registry. */
export class AppModuleBlockDto {
  /** Stable id; the server re-slugs and de-duplicates it when saving. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  id?: string;

  /** Block type from `GET /superadmin/modules/block-types`. */
  @IsString()
  @MaxLength(40)
  @Matches(/^[a-z][a-z0-9-]*$/, {
    message: 'type must be a lowercase block type',
  })
  type: string;

  @IsOptional()
  @IsObject()
  props?: Record<string, unknown>;
}

/** One authored section: an optional heading and text, plus its content. */
export class AppModuleSectionDto {
  /** Stable id; the server re-slugs and de-duplicates it when saving. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  /** Ready-made UI blocks, in render order. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => AppModuleBlockDto)
  blocks?: AppModuleBlockDto[];

  /** `key`s of `component` entries rendered inside this section. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  componentKeys?: string[];
}

/** Whole body of a page, in the order the app should render it. */
export class UpdateAppModuleContentDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => AppModuleSectionDto)
  sections: AppModuleSectionDto[];
}

/**
 * New order of a set of sibling entries (the tabs of one page). Sent as a
 * single request so a drag never burns through the rate limit or leaves the
 * list half-reordered when one call fails.
 */
export class ReorderAppModulesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  keys: string[];
}
