import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '@domain/dashboard/transaction.entity';

@Injectable()
export class ReportRepository {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  /** Monthly sums of income vs expenses, scoped to the requesting user. */
  async getMonthlyOverview(
    year: number,
    userId: number,
  ): Promise<{ month: string; income: number; expenses: number }[]> {
    return this.txRepo
      .createQueryBuilder('tx')
      .select("to_char(tx.date, 'Mon')", 'month')
      .addSelect(
        'SUM(CASE WHEN tx.amount > 0 THEN tx.amount ELSE 0 END)',
        'income',
      )
      .addSelect(
        'SUM(CASE WHEN tx.amount < 0 THEN -tx.amount ELSE 0 END)',
        'expenses',
      )
      .where('EXTRACT(YEAR FROM tx.date) = :year', { year })
      .andWhere('tx.userId = :userId', { userId })
      .groupBy("to_char(tx.date, 'Mon')")
      .orderBy('MIN(EXTRACT(MONTH FROM tx.date))')
      .getRawMany();
  }

  /** Sum by category over given period, scoped to the requesting user. */
  async getCategoryBreakdown(
    start: Date,
    end: Date,
    userId: number,
  ): Promise<{ category: string; total: number }[]> {
    return this.txRepo
      .createQueryBuilder('tx')
      .select('tx.category', 'category')
      .addSelect('SUM(tx.amount)', 'total')
      .where('tx.date BETWEEN :start AND :end', { start, end })
      .andWhere('tx.userId = :userId', { userId })
      .groupBy('tx.category')
      .orderBy('total', 'DESC')
      .getRawMany();
  }

  /** Weekly trend for last 7 days, scoped to the requesting user. */
  async getWeeklyTrend(
    userId: number,
  ): Promise<{ day: string; amount: number }[]> {
    return this.txRepo
      .createQueryBuilder('tx')
      .select("to_char(tx.date, 'Dy')", 'day')
      .addSelect('SUM(tx.amount)', 'amount')
      .where("tx.date >= CURRENT_DATE - INTERVAL '6 days'")
      .andWhere('tx.userId = :userId', { userId })
      .groupBy("to_char(tx.date, 'Dy')")
      .orderBy('MIN(tx.date)')
      .getRawMany();
  }

  /** Savings growth per month (income − expenses), scoped to the requesting user. */
  async getSavingsGrowth(
    year: number,
    userId: number,
  ): Promise<{ month: string; savings: number }[]> {
    const overview = await this.getMonthlyOverview(year, userId);
    return overview.map((o) => ({
      month: o.month,
      savings: o.income - o.expenses,
    }));
  }
}
