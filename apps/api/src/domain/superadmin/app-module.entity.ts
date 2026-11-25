import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/** Lifecycle of a product module as shown in the backoffice. */
export type AppModuleStatus = 'active' | 'beta' | 'disabled';

/**
 * What the entry is: a whole product module (`reports`), a reusable piece of
 * UI (`chart-category-donut`) or an external integration (`resend-email`).
 */
export type AppModuleKind = 'module' | 'component' | 'integration';

/**
 * A product module (dashboard widget, report, integration, …) registered from
 * the backoffice. The SPA does not consume this table yet: it is the inventory
 * the super admin keeps so features can be rolled out, versioned and switched
 * off without a redeploy.
 *
 * `isCore` marks modules that must never be disabled (auth, transactions).
 */
@Entity('app_modules')
export class AppModule {
  @PrimaryGeneratedColumn()
  id: number;

  /** Stable machine key, e.g. `reports-monthly`. Unique. */
  @Index('UQ_app_modules_key', { unique: true })
  @Column({ length: 80 })
  key: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ length: 16, default: 'module' })
  kind: AppModuleKind;

  @Column({ length: 40, default: 'core' })
  category: string;

  @Column({ length: 16, default: 'active' })
  status: AppModuleStatus;

  @Column({ length: 20, default: '1.0.0' })
  version: string;

  /** Ordering in the backoffice list; ties fall back to `name`. */
  @Column({ type: 'integer', name: 'sortOrder', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', name: 'isCore', default: false })
  isCore: boolean;

  @CreateDateColumn({ type: 'timestamp', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updatedAt' })
  updatedAt: Date;
}
