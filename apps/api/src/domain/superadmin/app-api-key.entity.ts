import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * An API key issued from the backoffice for machine-to-machine access.
 *
 * Only the SHA-256 hash of the secret is stored: the plaintext value is
 * returned once, by the create endpoint, and can never be read back. `prefix`
 * keeps the first characters visible so an operator can tell keys apart in the
 * list without exposing the credential.
 */
@Entity('app_api_keys')
export class AppApiKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  /** Public, non-secret head of the key: `bg_live_ab12cd`. */
  @Column({ length: 24 })
  prefix: string;

  @Column({ length: 64, name: 'hashedKey' })
  hashedKey: string;

  @Column({ type: 'simple-array', nullable: true })
  scopes: string[] | null;

  @Column({ type: 'timestamp', name: 'lastUsedAt', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'timestamp', name: 'revokedAt', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updatedAt' })
  updatedAt: Date;
}
