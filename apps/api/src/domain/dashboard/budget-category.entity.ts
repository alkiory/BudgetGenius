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

  @Column('numeric', {
    transformer: {
      to: (value: number) => value,
      from: (value: number | string) => {
        return Number(value);
      },
    },
  })
  spent: number;

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

/**
 * Canonical constraint name for the storage-layer UNIQUE invariant
 * introduced by migration `BudgetCategoryUniqueName1800000000003`.
 *
 * The migration hardcodes the identical string in its DDL (DDL is
 * intentionally self-contained — migrations are loaded by file path,
 * not by import graph, so a `const` import would break the migration
 * runner). Treat this constant as the runtime-side authority:
 *
 *   - `apps/api/src/application/dashboard/services/budget.service.ts`
 *     uses it to identify the SQLSTATE 23505 race path and translate it
 *     to a `BadRequestException` with the same surface error the
 *     in-app check throws.
 *   - `apps/api/test/budget-service.spec.ts` uses it to simulate the
 *     pg driver's `QueryFailedError` shape without duplicating the
 *     string in two places.
 *
 * If you rename the constraint in the migration, rename this constant
 * in lockstep — the test suite and the runtime translator both go
 * stale otherwise.
 */
export const BUDGET_CATEGORY_UNIQUE_CONSTRAINT_NAME =
  'UQ_budget_categories_budgetId_name';
