import { IsDateString, IsNotEmpty, IsNumber, IsString } from 'class-validator';

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

  @IsString()
  @IsNotEmpty()
  status: string;
}
