import { ExpenseCategory } from '@domain/dashboard/expense-category.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ExpenseCategoryRepository {
  constructor(
    @InjectRepository(ExpenseCategory)
    private readonly repo: Repository<ExpenseCategory>,
  ) {}

  async create(
    expenseCategory: Partial<ExpenseCategory>,
  ): Promise<ExpenseCategory> {
    const newExpenseCategory = this.repo.create(expenseCategory);
    return this.repo.save(newExpenseCategory);
  }
  async findByUser(userId: number): Promise<ExpenseCategory[]> {
    return this.repo.find({ where: { user: { id: userId } } });
  }
  async update({ id, name }: ExpenseCategory): Promise<ExpenseCategory> {
    const expenseCategory = await this.repo.findOneOrFail({ where: { id } });
    expenseCategory.name = name;
    await this.repo.save(expenseCategory);
    return expenseCategory;
  }
  async delete(id: number): Promise<void> {
    await this.repo.delete(id);
  }
  async findById(id: number): Promise<ExpenseCategory> {
    return this.repo.findOneOrFail({ where: { id } });
  }
  async findByName(name: string): Promise<ExpenseCategory> {
    return this.repo.findOneOrFail({ where: { name } });
  }
}
