import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsDate,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

export class CreateGoalDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  targetAmount: number;

  @IsOptional()
  @IsNumber()
  currentAmount?: number;

  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  dueDate: Date;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  contributionFrequency?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentAmount?: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  contributionFrequency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class GoalResponseDto {
  id: number;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  startDate: Date;
  dueDate: Date;
  status: string;
  type: string;
  contributionFrequency?: string;
  notes?: string;
}

export class UpdateGoalProgressDto {
  @IsNumber()
  @Min(0)
  amount: number;
}
