import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AppNotificationLevel = 'info' | 'success' | 'warning' | 'critical';
export type AppNotificationAudience = 'all' | 'free' | 'premium';

/**
 * An announcement authored from the backoffice and surfaced to app users.
 *
 * The row is the source of truth for what is live: `published` gates it,
 * `publishedAt` records when it went out and `expiresAt` lets an announcement
 * retire itself without anyone deleting it.
 */
@Entity('app_notifications')
export class AppNotification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 140 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ length: 16, default: 'info' })
  level: AppNotificationLevel;

  @Column({ length: 16, default: 'all' })
  audience: AppNotificationAudience;

  @Column({ type: 'boolean', default: false })
  published: boolean;

  @Column({ type: 'timestamp', name: 'publishedAt', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'timestamp', name: 'expiresAt', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ type: 'timestamp', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updatedAt' })
  updatedAt: Date;
}
