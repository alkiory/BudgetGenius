import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * One deposit into a savings goal, as typed in the catalogue's live planner.
 * The date is the day the money was put aside (not the day the button was
 * pressed), so historical contributions can be logged too.
 */
export class ContributeSavingsDto {
  @IsNumber()
  @IsNotEmpty()
  categoryId: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsPositive()
  amount: number;

  /** `YYYY-MM-DD` (or an ISO timestamp; only its calendar day is used). */
  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  description?: string;
}
