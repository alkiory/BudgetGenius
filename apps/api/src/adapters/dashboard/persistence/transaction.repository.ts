import { Transaction } from '@domain/dashboard/transaction.entity';
import { User } from '@domain/user/user.entity';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class TransactionRepository {
  constructor(
    @InjectRepository(Transaction)
    private readonly repo: Repository<Transaction>,
  ) {}

  async create(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
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

  async update({
    id,
    description,
    category,
    amount,
    status,
  }: Transaction): Promise<Transaction> {
    const transaction = await this.repo.findOneOrFail({ where: { id } });
    transaction.description = description;
    transaction.category = category;
    transaction.amount = amount;
    transaction.status = status;
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
  }: {
    offset: number;
    limit: number;
    userId: number;
  }) {
    const [transactions, total] = await this.repo.findAndCount({
      where: { user: { id: userId } },
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
