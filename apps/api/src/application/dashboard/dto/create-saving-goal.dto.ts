import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

export class CreateSavingGoalDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Transform(({ value }) => Number(value))
  current: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0, { message: 'Target amount must be greater than zero' })
  @Transform(({ value }) => Number(value))
  target: number;

  @IsDateString()
  @IsOptional()
  targetDate?: Date;

  @IsString()
  category: string;

  @IsString({})
  @IsOptional()
  color?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}

export class SavingGoalResponseDto {
  id: number;
  name: string;
  current: number;
  target: number;
  percentage: number;
  targetDate?: Date;
  category: string;
  color?: string;
}
