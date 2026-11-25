import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A credential Finny can call its provider with, managed from the backoffice.
 *
 * Rows are tried in `priority` order, so a second key acts as contingency when
 * the first one is rejected or rate-limited. The value is sealed with
 * AES-256-GCM (`secret-box`): the backoffice can reveal it again, but a
 * database dump alone does not expose the provider account.
 */
@Entity('app_provider_keys')
export class AppProviderKey {
  @PrimaryGeneratedColumn()
  id: number;

  /** Human label, e.g. "OpenAI principal" or "Contingencia". */
  @Column({ length: 80 })
  label: string;

  @Column({ length: 32, default: 'openai' })
  provider: string;

  /** `v1:iv:tag:ciphertext` — never the plaintext. */
  @Column({ type: 'text', name: 'encryptedKey' })
  encryptedKey: string;

  /** Last four characters of the plaintext, for at-a-glance identification. */
  @Column({ length: 4, name: 'lastFour' })
  lastFour: string;

  @Column({ type: 'boolean', name: 'isActive', default: true })
  isActive: boolean;

  /** Lower runs first. Ties fall back to creation time. */
  @Column({ type: 'integer', default: 0 })
  priority: number;

  @Column({ type: 'timestamptz', name: 'lastUsedAt', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'lastFailedAt', nullable: true })
  lastFailedAt: Date | null;

  @Column({ type: 'varchar', length: 240, name: 'lastError', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamp', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updatedAt' })
  updatedAt: Date;
}
