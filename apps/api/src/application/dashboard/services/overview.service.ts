import { OverviewRepository } from '@adapters/dashboard/persistence/overview.repository';
import { TransactionRepository } from '@adapters/dashboard/persistence/transaction.repository';
import { Transaction } from '@domain/dashboard/transaction.entity';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface RecentSummary {
  transactions: Transaction[];
  aggregate: {
    income: number;
    expense: number;
    net: number;
  };
}

@Injectable()
export class OverviewService {
  constructor(
    private dataSource: DataSource,
    private readonly repo: OverviewRepository,
    private readonly txRepo: TransactionRepository,
  ) {}

  async getOverview(userId: number): Promise<{
    income: number;
    expenses: number;
    balance: number;
    period: Date;
  }> {
    // sum of income transactions
    const { income } = await this.dataSource
      .getRepository('transactions')
      .createQueryBuilder('t')
      .select('SUM(t.amount)', 'income')
      .where('t.userId = :userId AND t.amount > 0', { userId })
      .getRawOne();

    // sum of expenses (negative amounts)
    const { expenses } = await this.dataSource
      .getRepository('transactions')
      .createQueryBuilder('t')
      .select('SUM(t.amount)', 'expenses')
      .where('t.userId = :userId AND t.amount < 0', { userId })
      .getRawOne();

    const inc = parseFloat(income) || 0;
    const exp = Math.abs(parseFloat(expenses) || 0);
    return {
      income: inc,
      expenses: exp,
      balance: inc - exp,
      period: new Date(),
    };
  }

  async getExpenseBreakdown(userId: number) {
    const byCat = await this.repo.getExpensesByCategory(userId);
    const total = byCat.reduce((sum, c) => sum + c.value, 0);
    // Find the largest category
    const largest = byCat.reduce(
      (prev, curr) => (curr.value > prev.value ? curr : prev),
      { name: '', value: 0 },
    );
    // Format the largest category
    largest.name = largest.name || 'No category yet';
    largest.value = largest.value || 0;
    // Format the byCat array
    const byCatFormatted = byCat.map((cat) => ({
      name: cat.name || 'No category yet',
      value: cat.value,
    }));
    // Add the period
    const period = new Date();
    const periodFormatted = period.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return {
      total,
      byCategory: byCatFormatted,
      largest,
      period: periodFormatted,
    };
  }

  /**
   * Combines a recent-transaction slice (size = `limit`) with the user's
   * all-time aggregate (income/expense/net) in a single response payload
   * for the dashboard widget. SQL aggregation backs the totals so they
   * reflect every transaction the user owns — not a per-page sample.
   *
   * Both lookups are read-only against `transactions` and dispatched via
   * Promise.all for latency; reads are taken from a snapshot so concurrent
   * writes during this call are tolerated (eventual consistency on the
   * client). Don't serialise the two queries unless you have a reason —
   * the parallelism is intentional.
   */
  async getRecentSummary(
    userId: number,
    limit: number,
  ): Promise<RecentSummary> {
    const [aggregate, { transactions }] = await Promise.all([
      this.repo.getAllTimeAggregate(userId),
      this.txRepo.findAndCount({ offset: 0, limit, userId }),
    ]);

    return { transactions, aggregate };
  }
}
