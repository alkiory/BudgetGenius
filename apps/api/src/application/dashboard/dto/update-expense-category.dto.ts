import { IsNumber, IsString, IsNotEmpty } from 'class-validator';

/**
 * HTTP-layer DTO for ExpenseCategory updates.
 *
 * This is intentionally lighter than the internal `UpdateExpenseDTO`,
 * which carries a vestigial `transactions: Transaction[]` field that the
 * service ignores. Exposing that field at the HTTP boundary would leak
 * the `Transaction` entity reference into Swagger and confuse API
 * consumers — it's the controller's job to translate the wire shape
 * into whatever the service accepts below.
 *
 * The URL `:id` is the source of truth for the category id (not the body)
 * to keep the path-parameter contract aligned with the other dashboard
 * controllers (budget, transactions).
 */
export class UpdateExpenseCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  value: number;
}
