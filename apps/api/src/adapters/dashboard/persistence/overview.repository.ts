import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Transaction } from '@domain/dashboard/transaction.entity';
import { BudgetCategory } from '@domain/dashboard/budget-category.entity';
import { Budget } from '@domain/dashboard/budget.entity';

export interface TransactionAggregate {
  income: number;
  expense: number;
  net: number;
}

/**
 * A savings deposit is a transaction linked to a category of a `savings`
 * budget. Filtering by the category *name* also hid ordinary transactions an
 * import happened to label "Savings"; the link is the actual discriminator.
 * Entity joins keep the query inside the configured schema (`bg_public`).
 */
const DEPOSIT_FILTER =
  "(tx.\"isSavingsDeposit\" = false AND (b.type IS NULL OR b.type <> 'savings'))";

@Injectable()
export class OverviewRepository {
  constructor(private readonly ds: DataSource) {}

  async getExpensesByCategory(
    userId: number,
  ): Promise<{ name: string; value: number }[]> {
    return (
      this.ds
        .getRepository(Transaction)
        .createQueryBuilder('tx')
        .select('tx.category', 'name')
        .addSelect('SUM(tx.amount)', 'value')
        .leftJoin(BudgetCategory, 'bc', 'bc.id = tx."budgetCategoryId"')
        .leftJoin(Budget, 'b', 'b.id = bc."budgetId"')
        .where('tx.userId = :userId', { userId })
        .andWhere('tx.amount < 0')
        // Savings deposits are transfers: visible in the ledger, never spending.
        .andWhere(DEPOSIT_FILTER)
        .groupBy('tx.category')
        .getRawMany<{ name: string; value: string }>()
        .then((rows) =>
          rows.map((r) => ({ name: r.name, value: Math.abs(Number(r.value)) })),
        )
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
      .leftJoin(BudgetCategory, 'bc', 'bc.id = tx."budgetCategoryId"')
      .leftJoin(Budget, 'b', 'b.id = bc."budgetId"')
      .where('tx.userId = :userId', { userId })
      // A deposit into a savings goal is still the user's money, so it must
      // not reduce the net total the dashboard shows.
      .andWhere(DEPOSIT_FILTER)
      .getRawOne<{ income: string | null; expense: string | null }>();

    const income = Number(row?.income) || 0;
    const expense = Number(row?.expense) || 0;
    return { income, expense, net: income - expense };
  }
}
