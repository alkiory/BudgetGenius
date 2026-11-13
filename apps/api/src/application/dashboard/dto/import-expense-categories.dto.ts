import { ArrayMaxSize, IsArray, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportExpenseCategoryItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  value: number;
}

export class ImportExpenseCategoriesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportExpenseCategoryItemDto)
  categories: ImportExpenseCategoryItemDto[];
}
