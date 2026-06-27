import {
  IsNotEmpty,
  IsString,
  IsDate,
  IsNumber,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateDateColumn, UpdateDateColumn } from 'typeorm';
import {
  IsEnum,
} from 'class-validator';
import { SupportedCurrency } from '@domain/user/user-settings.entity';

export class CreateBudgetDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  period: string;

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @IsNotEmpty()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  totalAllocated: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  totalSpent?: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetCategoryDto)
  categories?: CreateBudgetCategoryDto[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}

export class CreateBudgetCategoryDto {
  @IsNumber()
  budgetId?: number;

  @IsString()
  name: string;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  allocated: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  spent: number;

  @IsOptional()
  @IsEnum(['USD', 'EUR', 'COP'], {
    message: 'currency must be one of USD|EUR|COP',
  })
  currency?: SupportedCurrency;
}
