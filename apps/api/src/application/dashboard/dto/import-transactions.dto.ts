import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ImportTransactionItemDto {
  @IsDateString()
  date: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  recurrence?: string | null;
}

export class ImportTransactionsDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportTransactionItemDto)
  transactions: ImportTransactionItemDto[];
}
