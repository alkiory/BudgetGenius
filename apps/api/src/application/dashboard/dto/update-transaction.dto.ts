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
   * Same contract as the create DTO: omitted = the server re-resolves the
   * attribution from the new date/category/amount; explicit = must belong
   * to the caller. Incomes always end up unlinked.
   */
  @IsOptional()
  @IsNumber()
  budgetCategoryId?: number;

  /**
   * Optional recurrence — same semantics as the create DTO. Omitted = no
   * change on update (existing value is preserved); explicit `null` clears
   * it (handled by the repo layer).
   */
  @IsOptional()
  @IsString()
  recurrence?: string;
}
