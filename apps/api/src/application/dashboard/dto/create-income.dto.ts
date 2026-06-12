import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';
import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

export class CreateIncomeDto {
  @IsDateString()
  date: Date;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  recurrence: string;

  @IsNumber()
  @Min(0, { message: 'Amount must be greater than zero' })
  amount: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
