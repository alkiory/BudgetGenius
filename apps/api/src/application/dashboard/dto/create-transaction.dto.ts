import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

export class CreateTransactionDto {
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
   * Optional recurrence semantic — persisted when the row represents a
   * recurring income (e.g. "Monthly", "Bi-weekly"). Nullable so legacy
   * expense transactions remain unaffected. Mirrored on the update DTO.
   */
  @IsOptional()
  @IsString()
  recurrence?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
