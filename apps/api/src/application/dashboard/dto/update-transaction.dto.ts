import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateTransactionDto {
  @IsNumber()
  id: number;

  @IsDateString()
  date: Date;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  /**
   * Optional recurrence — same semantics as the create DTO. Omitted = no
   * change on update (existing value is preserved); explicit `null` clears
   * it (handled by the repo layer).
   */
  @IsOptional()
  @IsString()
  recurrence?: string;
}
