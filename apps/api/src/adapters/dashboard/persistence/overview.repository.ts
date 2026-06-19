import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Transaction } from '@domain/dashboard/transaction.entity';

export interface TransactionAggregate {
  income: number;
  expense: number;
  net: number;
}

@Injectable()
export class OverviewRepository {
  constructor(private readonly ds: DataSource) {}

  async getExpensesByCategory(
    userId: number,
  ): Promise<{ name: string; value: number }[]> {
    return this.ds
      .getRepository(Transaction)
      .createQueryBuilder('tx')
      .select('tx.category', 'name')
      .addSelect('SUM(tx.amount)', 'value')
      .where('tx.userId = :userId', { userId })
      .andWhere('tx.amount < 0')
      .groupBy('tx.category')
      .getRawMany<{ name: string; value: string }>()
      .then((rows) =>
        rows.map((r) => ({ name: r.name, value: Math.abs(Number(r.value)) })),
      );
  }

  /**
   * All-time income / expense / net totals for the given user, computed in
   * a single SQL round-trip. The dashboard widget uses these as authoritative
   * totals instead of a per-page reduce.
   *
   * Conventions: positive `amount` = income, negative `amount` = expense.
   * Expense field is the absolute value (positive number) regardless of
   * how it's stored in the database.
   */
  async getAllTimeAggregate(userId: number): Promise<TransactionAggregate> {
    const row = await this.ds
      .getRepository(Transaction)
      .createQueryBuilder('tx')
      .select(
        'SUM(CASE WHEN tx.amount >= 0 THEN tx.amount ELSE 0 END)',
        'income',
      )
      .addSelect(
        'SUM(CASE WHEN tx.amount < 0 THEN ABS(tx.amount) ELSE 0 END)',
        'expense',
      )
      .where('tx.userId = :userId', { userId })
      .getRawOne<{ income: string | null; expense: string | null }>();

    const income = Number(row?.income) || 0;
    const expense = Number(row?.expense) || 0;
    return { income, expense, net: income - expense };
  }
}
