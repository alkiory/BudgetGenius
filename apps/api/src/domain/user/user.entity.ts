import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BeforeInsert,
  OneToMany,
  BeforeUpdate,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Budget } from '@domain/dashboard/budget.entity';
import { ExpenseCategory } from '@domain/dashboard/expense-category.entity';
import { Overview } from '@domain/dashboard/overview.entity';
import { SavingGoal } from '@domain/dashboard/saving-goal.entity';
import { Transaction } from '@domain/dashboard/transaction.entity';
import { UserSettings } from './user-settings.entity';
import { Income } from '@domain/dashboard/income.entity';
import { Goal } from '@domain/dashboard/goal.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  surname: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  password: string;

  @Column({ default: 'email' })
  authProvider: 'email' | 'google';

  @Column()
  role: string;

  @Column({ nullable: true })
  refreshToken: string;

  @Column()
  isPremium: boolean;

  @CreateDateColumn({ type: 'timestamp', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updatedAt' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  async comparePassword(attempt: string) {
    return await bcrypt.compare(attempt, this.password);
  }

  // Relations
  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions: Transaction[];

  @OneToMany(() => Budget, (bp) => bp.user)
  budgets: Budget[];

  @OneToMany(() => ExpenseCategory, (ec) => ec.user)
  expenseCategories: ExpenseCategory[];

  @OneToMany(() => SavingGoal, (sg) => sg.user)
  savingGoals: SavingGoal[];

  @OneToMany(() => Overview, (overview) => overview.user)
  overviews: Overview[];

  @OneToMany(() => UserSettings, (settings) => settings.user)
  settings: UserSettings[];

  @OneToMany(() => Income, (income) => income.user)
  incomes: Income[];

  @OneToMany(() => Goal, (goal) => goal.user)
  goals: Goal[];
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}
