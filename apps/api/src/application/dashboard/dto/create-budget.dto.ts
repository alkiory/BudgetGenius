import {
  IsNotEmpty,
  IsString,
  IsDate,
  IsNumber,
  ValidateNested,
  IsOptional,
  IsIn,
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

  /** Budget semantics for every category: expense cap or savings goal. */
  @IsOptional()
  @IsIn(['spending', 'savings'], {
    message: 'type must be one of spending|savings',
  })
  type?: 'spending' | 'savings';

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

  /** Manual baseline; omitted on create so new categories start at 0. */
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  manualSpent?: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  spent?: number;

  @IsOptional()
  @IsEnum(['USD', 'EUR', 'COP'], {
    message: 'currency must be one of USD|EUR|COP',
  })
  currency?: SupportedCurrency;
}
