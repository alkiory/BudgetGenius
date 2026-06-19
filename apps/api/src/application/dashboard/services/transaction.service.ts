import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { TransactionRepository } from '@adapters/dashboard/persistence/transaction.repository';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';
import { User } from '@domain/user/user.entity';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';

@Injectable()
export class TransactionService {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly userRepo: UserRepositoryImpl,
  ) {}

  async createTransaction(
    userId: number,
    dto: Omit<CreateTransactionDto, 'id'>,
  ) {
    // `findByUser` throws NotFoundException if user doesn't exist, so no need for a null check
    const user = await this.transactionRepo.findByUser(userId);

    // Normalize `recurrence` so the built object fully satisfies the entity's
    // nullable column contract — `Omit<Transaction, 'id'>` requires the field
    // (it can be `null`, but not `undefined`).
    const transaction = {
      ...dto,
      recurrence: dto.recurrence ?? null,
      user: { id: user.id } as User,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.transactionRepo.create(transaction);
  }

  async getTransactionsByUser({
    userId,
    offset,
    limit,
    type,
  }: {
    userId: number;
    offset: number;
    limit: number;
    type?: 'income' | 'expense';
  }) {
    // Verify user exists — `findById` returns null if not found
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Query the database directly instead of relying on an eager-loaded relation.
    // Phase 3 (T3.3): forward the optional `type` filter to the repository,
    // which applies a sign-convention where-clause (MoreThan(0) / LessThan(0))
    // when present. Omitted type returns all transactions — preserves
    // existing callers (transactionPage) unchanged.
    return this.transactionRepo.findAndCount({
      offset,
      limit,
      userId,
      type,
    });
  }

  async updateTransaction(
    userId: number,
    dto: Omit<UpdateTransactionDto, 'createdAt'>,
  ) {
    // Verify user exists - `findByUser` throws NotFoundException if not
    await this.transactionRepo.findByUser(userId);

    const existingTransaction = await this.transactionRepo.findOne(dto.id);
    // `findOne` also throws NotFoundException if not found, but check is explicit
    if (!existingTransaction) {
      throw new NotFoundException(`Transaction with ID ${dto.id} not found`);
    }

    // `recurrence` is intentionally NOT seeded here — the repo's
    // destructured-undefined guard preserves the existing value when the dto
    // omits the field (matches the partial-update contract on the controller).
    const transaction = {
      ...dto,
      user: { id: userId } as User,
      createdAt: existingTransaction.createdAt,
      updatedAt: new Date(),
    };
    return this.transactionRepo.update(transaction);
  }
  async deleteTransaction(
    transactionId: number,
    userId: number,
  ): Promise<boolean> {
    const transaction = await this.transactionRepo.findOne(transactionId);

    if (!transaction) {
      return false;
    }

    if (transaction.user.id !== userId) {
      return false;
    }

    await this.transactionRepo.delete(transactionId);
    return true;
  }

  async deleteAllTransactions(userId: number, transactions: any) {
    const user = await this.transactionRepo.findByUser(userId);

    if (transactions.length === user.transactions.length) {
      await this.transactionRepo.deleteAllTransactions(userId);
      return {
        message: 'All transactions deleted successfully',
      };
    }
    const transactionsToDelete = user.transactions.filter(
      (transaction) => transactions?.transactions.includes(transaction.id),
    );

    if (transactionsToDelete.length === 0) {
      return {
        message: 'No transactions to delete',
      };
    }

    await Promise.all(
      transactionsToDelete.map((transaction) =>
        this.transactionRepo.delete(transaction.id),
      ),
    );

    return {
      message: 'Selected transactions deleted successfully',
    };
  }
}
