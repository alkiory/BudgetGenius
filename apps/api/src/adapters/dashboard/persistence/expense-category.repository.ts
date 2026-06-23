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
  async update(
    // Require id explicitly so callers can't accidentally pass
    // `{id: undefined}` — TypeORM would otherwise interpret the undefined
    // entry in the where-clause as "no filter" and return the first row
    // owned by `userId`, which is a privilege-escalation hazard. Tighten
    // the type with `Pick` rather than `Partial` so any future caller has
    // to provide an id or face a compile-time error.
    category: Pick<ExpenseCategory, 'id' | 'name'>,
    userId: number,
  ): Promise<ExpenseCategory> {
    // findOneOrFail with the userId where-clause throws
    // EntityNotFoundError on foreign ids — service maps to NotFoundException
    // so the controller returns 404, not 403.
    const expenseCategory = await this.repo.findOneOrFail({
      where: { id: category.id, user: { id: userId } },
    });
    expenseCategory.name = category.name;
    await this.repo.save(expenseCategory);
    return expenseCategory;
  }
  async delete(id: number, userId: number): Promise<void> {
    // WHERE-scoped DELETE; foreign ids become a no-op at the SQL level
    // (`affected = 0`). Caller can read its own DeleteResult if it needs
    // a boolean.
    await this.repo.delete({ id, user: { id: userId } });
  }
  async findById(id: number, userId: number): Promise<ExpenseCategory> {
    return this.repo.findOneOrFail({
      where: { id, user: { id: userId } },
    });
  }
  async findByName(name: string, userId: number): Promise<ExpenseCategory> {
    return this.repo.findOneOrFail({
      where: { name, user: { id: userId } },
    });
  }
}
