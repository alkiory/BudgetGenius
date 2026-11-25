import { IsNumber } from 'class-validator';

export class ReconcileExpenseDto {
  @IsNumber()
  budgetCategoryId: number;
}
