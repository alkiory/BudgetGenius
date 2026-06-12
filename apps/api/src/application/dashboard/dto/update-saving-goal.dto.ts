import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateSavingGoalDto {
  @IsNumber()
  id: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Transform(({ value }) => Number(value))
  current: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Transform(({ value }) => Number(value))
  target: number;

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => Number(value))
  percentage?: number;

  @IsDateString()
  @IsOptional()
  targetDate?: Date;

  @IsString()
  category: string;

  @IsString({})
  @IsOptional()
  color?: string;
}
