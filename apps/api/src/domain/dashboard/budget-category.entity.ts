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
import { SupportedCurrency } from '@domain/user/user-settings.entity';

@Entity('budget_categories')
export class BudgetCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: ['USD', 'EUR', 'COP'],
    enumName: 'currency_enum',
    nullable: false,
    default: 'USD',
  })
  currency: SupportedCurrency;

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

export const BUDGET_CATEGORY_UNIQUE_CONSTRAINT_NAME =
  'UQ_budget_categories_budgetId_name';
