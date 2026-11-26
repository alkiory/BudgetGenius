import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity';
import { BudgetCategory } from './budget-category.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: Date;

  @Column()
  description: string;

  @Column()
  category: string;

  /**
   * D2.2: attribution frozen at write time. `NULL` means "not attributed"
   * (income, ambiguous category or no matching budget) and readers fall
   * back to the legacy window + category-name match. `ON DELETE SET NULL`
   * means deleting a category never deletes ledger rows.
   */
  @Column({ type: 'integer', nullable: true })
  budgetCategoryId: number | null;

  @ManyToOne(() => BudgetCategory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'budgetCategoryId' })
  budgetCategory?: BudgetCategory | null;

  @Column('numeric', {
    transformer: {
      to: (value: number) => value,
      from: (value: number | string) => {
        return Number(value);
      },
    },
  })
  amount: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  recurrence: string | null;

  /**
   * True when this ledger row is a transfer into a savings goal. Persisted on
   * the row so deleting the goal or category later does not turn historical
   * savings deposits into ordinary expenses in reports or dashboard totals.
   */
  @Column({ type: 'boolean', default: false })
  isSavingsDeposit: boolean;

  @CreateDateColumn({ type: 'timestamp', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updatedAt' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.transactions)
  @JoinColumn({ name: 'userId' })
  user: User;
}
