import { Transaction } from '@domain/dashboard/transaction.entity';
import { User } from '@domain/user/user.entity';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';

@Injectable()
export class TransactionRepository {
  constructor(
    @InjectRepository(Transaction)
    private readonly repo: Repository<Transaction>,
  ) {}

  async create(
    transaction: Partial<Omit<Transaction, 'id'>>,
  ): Promise<Transaction> {
    // Match the service's spread-shape builder, which may carry `recurrence`
    // as either a value, null, or absent. Defaults still land via the
    // nullable column at the DB layer.
    const newTransaction = this.repo.create(transaction);
    return this.repo.save(newTransaction);
  }

  async findByUser(userId: number): Promise<User> {
    const userRepo = this.repo.manager.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: userId },
      relations: ['transactions'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  async findOne(id: number): Promise<Transaction> {
    const transaction = await this.repo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }
    return transaction;
  }

  async update(
    data: Partial<Transaction> & { id: number },
  ): Promise<Transaction> {
    const { id, description, category, amount, recurrence } = data;
    const transaction = await this.repo.findOneOrFail({ where: { id } });
    transaction.description = description;
    transaction.category = category;
    transaction.amount = amount;
    // Partial-update contract: omitted = preserve, explicit value = overwrite.
    // The `undefined` check is critical — a default parameter (e.g. `= null`)
    // would coerce it to null and silently wipe an existing recurrence.
    if (recurrence !== undefined) {
      transaction.recurrence = recurrence;
    }
    await this.repo.save(transaction);
    return transaction;
  }
  async delete(id: number): Promise<boolean> {
    const deletedTransaction = await this.repo.findOne({ where: { id } });
    if (!deletedTransaction) {
      return false;
    }
    await this.repo.delete(id);
    return true;
  }

  async deleteAllTransactions(userId: number) {
    try {
      const user = await this.findByUser(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (user.transactions.length === 0) {
        return { message: 'No transactions found for this user' };
      }
      const transactions = user.transactions;
      await this.repo.remove(transactions);
    } catch (error) {
      console.error('Error deleting transactions:', error);
      throw new InternalServerErrorException('Error deleting transactions');
    }
  }

  async findAndCount({
    offset,
    limit,
    userId,
    type,
  }: {
    offset: number;
    limit: number;
    userId: number;
    type?: 'income' | 'expense';
  }) {
    // Phase 3 (T3.3): apply a sign-convention where-clause only when the
    // controller forwarded an explicit `type` filter. Omitting the key
    // when `type` is undefined preserves every existing caller's
    // behavior (transactionPage passes no `type` and expects the full
    // unfiltered list).
    const where: Record<string, unknown> = { user: { id: userId } };
    if (type === 'income') {
      where.amount = MoreThan(0);
    } else if (type === 'expense') {
      where.amount = LessThan(0);
    }

    const [transactions, total] = await this.repo.findAndCount({
      where,
      skip: offset,
      take: limit,
      order: {
        date: 'DESC',
      },
    });
    return {
      transactions,
      meta: {
        total,
        offset,
        limit,
        nextOffset: offset + limit < total ? offset + limit : null,
      },
    };
  }
}
