import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Transaction } from '@domain/dashboard/transaction.entity';
import { BudgetCategory } from '@domain/dashboard/budget-category.entity';
import { Budget } from '@domain/dashboard/budget.entity';

/**
 * Deposits into a savings goal are transfers, not spending: they must not
 * inflate expense totals, category breakdowns or the savings-rate maths.
 *
 * Detect them by their link to a `savings` budget category, not by the
 * transaction's category label: a row an import happened to label "Savings"
 * is ordinary spending and must stay in the aggregates. The joins use entity
 * metadata, so the configured schema (`bg_public`) is preserved.
 */
const DEPOSIT_FILTER = "(b.type IS NULL OR b.type <> 'savings')";

const excludeSavingsDeposits = (
  query: SelectQueryBuilder<Transaction>,
): SelectQueryBuilder<Transaction> =>
  query
    .leftJoin(BudgetCategory, 'bc', 'bc.id = tx."budgetCategoryId"')
    .leftJoin(Budget, 'b', 'b.id = bc."budgetId"')
    .andWhere(DEPOSIT_FILTER);

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
    const query = this.txRepo
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
      .andWhere('tx.userId = :userId', { userId });

    return excludeSavingsDeposits(query)
      .groupBy("to_char(tx.date, 'Mon')")
      .orderBy('MIN(EXTRACT(MONTH FROM tx.date))')
      .getRawMany();
  }

  /** Monthly sums for an arbitrary period, including the year in each label. */
  async getMonthlyOverviewForRange(
    start: Date,
    end: Date,
    userId: number,
  ): Promise<
    { month: string; monthKey: string; income: number; expenses: number }[]
  > {
    const query = this.txRepo
      .createQueryBuilder('tx')
      .select("to_char(tx.date, 'Mon YYYY')", 'month')
      .addSelect("to_char(tx.date, 'YYYY-MM')", 'monthKey')
      .addSelect(
        'SUM(CASE WHEN tx.amount > 0 THEN tx.amount ELSE 0 END)',
        'income',
      )
      .addSelect(
        'SUM(CASE WHEN tx.amount < 0 THEN -tx.amount ELSE 0 END)',
        'expenses',
      )
      .where('tx.date >= :start AND tx.date < :end', { start, end })
      .andWhere('tx.userId = :userId', { userId });

    return excludeSavingsDeposits(query)
      .groupBy("to_char(tx.date, 'Mon YYYY')")
      .addGroupBy("to_char(tx.date, 'YYYY-MM')")
      .orderBy("MIN(date_trunc('month', tx.date))")
      .getRawMany();
  }

  /** Sum by category over given period, scoped to the requesting user. */
  async getCategoryBreakdown(
    start: Date,
    end: Date,
    userId: number,
  ): Promise<{ category: string; total: number }[]> {
    const query = this.txRepo
      .createQueryBuilder('tx')
      .select('tx.category', 'category')
      .addSelect('SUM(-tx.amount)', 'total')
      .where('tx.date >= :start AND tx.date < :end', { start, end })
      .andWhere('tx.amount < 0')
      .andWhere('tx.userId = :userId', { userId });

    return excludeSavingsDeposits(query)
      .groupBy('tx.category')
      .orderBy('total', 'DESC')
      .getRawMany();
  }

  /** Expense and income totals by category from the same date window. */
  async getCategoryBreakdowns(
    start: Date,
    end: Date,
    userId: number,
  ): Promise<{ category: string; expenses: number; income: number }[]> {
    const query = this.txRepo
      .createQueryBuilder('tx')
      .select('tx.category', 'category')
      .addSelect(
        'SUM(CASE WHEN tx.amount < 0 THEN -tx.amount ELSE 0 END)',
        'expenses',
      )
      .addSelect(
        'SUM(CASE WHEN tx.amount > 0 THEN tx.amount ELSE 0 END)',
        'income',
      )
      // Exclusive end: callers pass the day after the last day they want,
      // matching the range endpoint and the planner's calendar window.
      .where('tx.date >= :start AND tx.date < :end', { start, end })
      .andWhere('tx.userId = :userId', { userId });

    return excludeSavingsDeposits(query).groupBy('tx.category').getRawMany();
  }

  /** Weekly trend for last 7 days, scoped to the requesting user. */
  async getWeeklyTrend(
    userId: number,
    start?: Date,
    end?: Date,
  ): Promise<{ day: string; amount: number }[]> {
    const query = this.txRepo
      .createQueryBuilder('tx')
      .select("to_char(tx.date, 'Dy')", 'day')
      .addSelect('SUM(-tx.amount)', 'amount')
      .where('tx.amount < 0')
      .andWhere('tx.userId = :userId', { userId });

    excludeSavingsDeposits(query);

    if (start && end) {
      query.andWhere('tx.date >= :start AND tx.date < :end', { start, end });
    } else {
      query.andWhere("tx.date >= CURRENT_DATE - INTERVAL '6 days'");
    }

    return query
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
