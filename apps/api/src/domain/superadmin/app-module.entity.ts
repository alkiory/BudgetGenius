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
 * UI (`chart-category-donut`), an external integration (`resend-email`), a
 * navigable page (`dashboard`) or a tab inside one (`reports-trends`).
 */
export type AppModuleKind =
  | 'module'
  | 'component'
  | 'integration'
  | 'page'
  | 'tab';

/**
 * One placed content block: `type` picks the renderer, `props` is what the
 * operator filled in the backoffice. The schema for `props` lives in
 * `application/superadmin/page-blocks.ts`, which is also what validates it.
 */
export interface AppModuleBlock {
  /** Stable id, `[a-z0-9-]`. Kept by the editor so reordering never remounts. */
  id: string;
  type: string;
  props: Record<string, unknown>;
}

/**
 * One authored section of a page: an optional heading and text, the blocks that
 * render inside it, and the reusable components placed there. The app renders
 * these in the order stored here, so composing a page never needs a deploy.
 */
export interface AppModuleSection {
  /** Stable id, `[a-z0-9-]`. Kept by the editor so reordering never remounts. */
  id: string;
  title: string;
  body: string;
  /** Ready-made UI blocks (callout, stats, steps, FAQ, …). */
  blocks?: AppModuleBlock[];
  /** `key`s of `component` entries shown inside the section. */
  componentKeys: string[];
}

/** Body of a page/module/tab, authored in the backoffice. */
export interface AppModuleContent {
  sections: AppModuleSection[];
}

/**
 * A product module (dashboard widget, report, integration, …) registered from
 * the backoffice. The SPA renders a sidebar entry and a page for every `module`
 * / `page` row whose status allows it, and reads `content` for the copy.
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

  /**
   * For `kind: 'component'` (and the odd integration that only makes sense
   * inside a module): the `key` of the module it belongs to, e.g. the
   * `card-type` component under the `cards` module. `null` means the entry
   * stands on its own.
   */
  @Column({ type: 'varchar', length: 80, name: 'parentKey', nullable: true })
  parentKey: string | null;

  @Column({ length: 16, default: 'active' })
  status: AppModuleStatus;

  @Column({ length: 20, default: '1.0.0' })
  version: string;

  /** Ordering in the backoffice list; ties fall back to `name`. */
  @Column({ type: 'integer', name: 'sortOrder', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', name: 'isCore', default: false })
  isCore: boolean;

  /**
   * Authored page body. Null on entries that were never edited, which the app
   * renders exactly as before (description + children).
   */
  @Column({ type: 'jsonb', nullable: true })
  content: AppModuleContent | null;

  @CreateDateColumn({ type: 'timestamp', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updatedAt' })
  updatedAt: Date;
}
