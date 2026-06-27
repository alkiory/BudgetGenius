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

  // Wave 3 [T3.5]: optional per-category currency. Resolved by
  // `BudgetService.createBudgetCategory` to `user.settings.currency`
  // (then `'USD'` as the cold-start default) when absent — keeping
  // the field optional preserves backwards-compat with native /
  // older web clients that don't yet know about it. The 3-value
  // enum is enforced server-side via the matching `currency_enum`
  // Postgres type introduced by the user_settings migration
  // (`1800000000002-EnumUserSettingsCurrency`).
  @IsOptional()
  @IsEnum(['USD', 'EUR', 'COP'], {
    message: 'currency must be one of USD|EUR|COP',
  })
  currency?: SupportedCurrency;
}
