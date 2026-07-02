import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
export type SupportedCurrency = 'USD' | 'EUR' | 'COP';

@Entity('user_settings')
export class UserSettings {
  @PrimaryGeneratedColumn() id: number;

  @Column() timezone: string;

  @Column({
    type: 'enum',
    enum: ['USD', 'EUR', 'COP'],
    enumName: 'currency_enum',
  })
  currency: SupportedCurrency;

  @Column() locale: string;

  @Column({ type: 'boolean', default: false })
  hasCompletedOnboarding: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @CreateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  // v1.7.4.1 — make the FK column name self-documenting. The DB
  // already has `userId` FK on `bg_public.user_settings` (see migration
  // `1776510954066-InitialMigration.ts`), so this is metadata-only,
  // schema-stays-the-same. Aligned with the explicit-`@JoinColumn`
  // pattern used by `Transaction`, `Budget`, `ExpenseCategory`,
  // `Overview` (where `@OneToMany` users can visually confirm the FK).
  // Without this, a future contributor reading the bare
  // `@ManyToOne(() => User) user: User` may assume the FK column is
  // the relation-camelCase default and write criteria like
  // `{ userId: id }` in a `tx.delete` call — which TypeORM rejects
  // because the entity has NO literal `userId` property. The relation-
  // traversal form `{ user: { id } }` is the canonical workaround;
  // this @JoinColumn annotation just makes the FK name explicit so
  // the audit surface shows it on the entity itself.
  @ManyToOne(() => User, (user) => user.settings)
  @JoinColumn({ name: 'userId' })
  user: User;
}
