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

  /** Monthly sums of income vs expenses */
  async getMonthlyOverview(
    year: number,
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
      .groupBy("to_char(tx.date, 'Mon')")
      .orderBy('MIN(EXTRACT(MONTH FROM tx.date))')
      .getRawMany();
  }

  /** Sum by category over given period */
  async getCategoryBreakdown(
    start: Date,
    end: Date,
  ): Promise<{ category: string; total: number }[]> {
    return this.txRepo
      .createQueryBuilder('tx')
      .select('tx.category', 'category')
      .addSelect('SUM(tx.amount)', 'total')
      .where('tx.date BETWEEN :start AND :end', { start, end })
      .groupBy('tx.category')
      .orderBy('total', 'DESC')
      .getRawMany();
  }

  /** Weekly trend for last 7 days */
  async getWeeklyTrend(): Promise<{ day: string; amount: number }[]> {
    return this.txRepo
      .createQueryBuilder('tx')
      .select("to_char(tx.date, 'Dy')", 'day')
      .addSelect('SUM(tx.amount)', 'amount')
      .where("tx.date >= CURRENT_DATE - INTERVAL '6 days'")
      .groupBy("to_char(tx.date, 'Dy')")
      .orderBy('MIN(tx.date)')
      .getRawMany();
  }

  /** Savings growth per month (income − expenses) */
  async getSavingsGrowth(
    year: number,
  ): Promise<{ month: string; savings: number }[]> {
    const overview = await this.getMonthlyOverview(year);
    return overview.map((o) => ({
      month: o.month,
      savings: o.income - o.expenses,
    }));
  }
}
