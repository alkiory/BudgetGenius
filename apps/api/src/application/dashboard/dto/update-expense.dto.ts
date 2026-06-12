import { Transaction } from '@domain/dashboard/transaction.entity';
import { IsArray, IsNumber, IsString } from 'class-validator';

export class UpdateExpenseDTO {
  @IsNumber()
  id: number;
  @IsString()
  name: string;

  @IsNumber()
  value: number;

  @IsArray()
  transactions: Transaction[];
}
