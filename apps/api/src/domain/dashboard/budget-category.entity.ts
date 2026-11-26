import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Budget } from './budget.entity';

@Entity('budget_categories')
export class BudgetCategory {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * No per-category currency: D1 makes `user_settings.currency` the single
   * money unit of the account (migration 1800000000011 dropped the copy).
   */
  @Column()
  name: string;

  @Column('numeric', {
    transformer: {
      to: (value: number) => value,
      from: (value: number | string) => {
        return Number(value);
      },
    },
  })
  allocated: number;

  /**
   * Manually tracked portion of the amount. For spending budgets this is
   * the baseline added through "Añadir gasto"; for savings budgets it is
   * the part saved without a ledger row. The effective `spent` exposed by
   * the API is always `manualSpent + transactionSpent`, where savings
   * deposits are summed from their linked transactions. Existing rows
   * migrated their legacy `spent` value into this column.
   */
  @Column('numeric', {
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: number | string) => Number(value),
    },
  })
  manualSpent: number;

  @Column('numeric', {
    transformer: {
      to: (value: number) => value,
      from: (value: number | string) => {
        return Number(value);
      },
    },
  })
  spent: number;

  /**
   * Read-only enrichment: expense transactions summed for this category
   * within the parent budget's date range. Not persisted; computed by
   * `BudgetService` on every read so it always reflects the ledger.
   */
  transactionSpent?: number;

  @CreateDateColumn({ type: 'timestamp', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updatedAt' })
  updatedAt: Date;

  @ManyToOne(() => Budget, (budget) => budget.categories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'budgetId' })
  budget: Budget;
}

export const BUDGET_CATEGORY_UNIQUE_CONSTRAINT_NAME =
  'UQ_budget_categories_budgetId_name';
