import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';
import { CreateExpenseDto } from '../dto/create-expense.dto';
import { UpdateExpenseDTO } from '../dto/update-expense.dto';
import { TransactionRepository } from '@adapters/dashboard/persistence/transaction.repository';
import { ExpenseCategoryRepository } from '@adapters/dashboard/persistence/expense-category.repository';

@Injectable()
export class ExpenseCategoryService {
  constructor(
    private readonly expenseCategoryRepo: ExpenseCategoryRepository,
    private readonly transactionRepo: TransactionRepository,
    private readonly userRepo: UserRepositoryImpl,
  ) {}
  async createExpenseCategory(userId: number, dto: CreateExpenseDto) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      // Surface as Nest's NotFoundException so the controller flows a
      // clean 404 (rather than 500) for the multi-tenant case. Generic
      // `Error` is a security smell at the HTTP layer because it leaks
      // 5xx-class behaviour on what's actually a "not-found".
      throw new NotFoundException('User not found');
    }
    const category = {
      ...dto,
      user: user,
    };
    return this.expenseCategoryRepo.create(category);
  }
  async getExpenseCategoriesByUser(userId: number) {
    return this.expenseCategoryRepo.findByUser(userId);
  }
  async updateExpenseCategory(
    userId: number,
    dto: Omit<UpdateExpenseDTO, 'createdAt'>,
  ) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // The repo's `update` throws EntityNotFoundError for any id that does
    // not match the user — including the edge case where the user has
    // zero expense categories. The previous early `return []` short-circuit
    // was misleading (it implied success-with-empty-data instead of 404),
    // so it's been removed: a foreign id or missing category now produces
    // a clean NotFoundException that the controller surfaces as 404.
    //
    // Type-wise: the repo takes `Pick<ExpenseCategory, 'id' | 'name'>` so
    // both id and name must be assignable. We pass `id` and `name` from
    // the dto (validated by ValidationPipe upstream), and TS structural
    // typing permits the extra `user`/`updatedAt` keys as long as `id` and
    // `name` are required fields on the inferred literal type — they are,
    // because we never mark this literal as `Partial<...>`.
    return this.expenseCategoryRepo.update(
      {
        id: dto.id,
        name: dto.name,
      },
      userId,
    );
  }
  async deleteExpenseCategory(userId: number, id: number) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.expenseCategoryRepo.delete(id, userId);
  }
  async getTransactionsByUser(userId: number) {
    return this.transactionRepo.findByUser(userId);
  }
  async getExpenseCategoryById(userId: number, id: number) {
    // Local-list scan: foreign ids are naturally absent from the user's
    // list (the repo scopes by `user.id` via findByUser). Either the id
    // really doesn't exist for this user, or it's owned by another user.
    // Both cases must surface as 404 — not 500 — so we throw Nest's
    // NotFoundException instead of a generic Error.
    return this.expenseCategoryRepo.findByUser(userId).then((categories) => {
      const category = categories.find((cat) => cat.id === id);
      if (!category) {
        throw new NotFoundException('Expense category not found');
      }
      return category;
    });
  }
}
