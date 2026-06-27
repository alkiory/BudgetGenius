import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsNumber,
  ValidateNested,
  IsDate,
  IsEnum,
} from 'class-validator';
import { SupportedCurrency } from '@domain/user/user-settings.entity';

export class UpdateBudgetDto {
  @IsNumber()
  id: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @IsOptional()
  @IsNumber()
  totalAllocated?: number;

  @IsOptional()
  @IsNumber()
  totalSpent?: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateBudgetCategoryDto)
  categories?: UpdateBudgetCategoryDto[];
}

export class UpdateBudgetCategoryDto {
  @IsNumber()
  id: number;

  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  allocated: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  spent: number;

  @IsOptional()
  @IsEnum(['USD', 'EUR', 'COP'], {
    message: 'currency must be one of USD|EUR|COP',
  })
  currency?: SupportedCurrency;
}
