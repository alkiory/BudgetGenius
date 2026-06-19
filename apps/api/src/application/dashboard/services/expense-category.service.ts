import { Injectable } from '@nestjs/common';
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
      throw new Error('User not found');
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
      throw new Error('User not found');
    }

    if (user.expenseCategories.length === 0) {
      return [];
    }
    const existingCategory = await this.expenseCategoryRepo.findById(dto.id);
    if (!existingCategory) {
      throw new Error('Expense category not found');
    }
    const category = {
      ...dto,
      user: user,
      createdAt: existingCategory.createdAt,
      updatedAt: new Date(),
    };
    return this.expenseCategoryRepo.update(category);
  }
  async deleteExpenseCategory(userId: number, id: number) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return this.expenseCategoryRepo.delete(id);
  }
  async getTransactionsByUser(userId: number) {
    return this.transactionRepo.findByUser(userId);
  }
  async getExpenseCategoryById(userId: number, id: number) {
    return this.expenseCategoryRepo.findByUser(userId).then((categories) => {
      const category = categories.find((cat) => cat.id === id);
      if (!category) {
        throw new Error('Expense category not found');
      }
      return category;
    });
  }
}
