import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@domain/user/user.entity';
import { BudgetCategory } from './budget-category.entity';

@Entity('budgets')
export class Budget {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  period: string;

  @Column('date')
  startDate: Date;

  @Column('date')
  endDate: Date;

  /**
   * Semantic of every category in this budget:
   * - `spending` — category limits are expense caps; transactions in the
   *   category during the budget window consume the limit.
   * - `savings` — category limits are savings goals; money is added
   *   manually and never linked to expense transactions.
   * Existing rows predate the concept and default to `spending`.
   */
  @Column({ type: 'varchar', length: 16, default: 'spending' })
  type: 'spending' | 'savings';

  @Column('numeric', {
    transformer: {
      to: (value: number) => value,
      from: (value: number | string) => {
        return Number(value);
      },
    },
  })
  totalAllocated: number;

  @Column('numeric', {
    transformer: {
      to: (value: number) => value,
      from: (value: number | string) => {
        return Number(value);
      },
    },
  })
  totalSpent: number;

  @CreateDateColumn({ type: 'timestamp', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updatedAt' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.budgets)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => BudgetCategory, (category) => category.budget, {
    cascade: true,
  })
  categories: BudgetCategory[];
}
