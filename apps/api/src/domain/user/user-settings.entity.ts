import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

// MVP-supported currencies. Mirrors the narrowed `Currency` type on
// the webClient (apps/webClient/src/presentation/utils/currencyService.ts)
// and the Postgres ENUM created by migration 1800000000002.
export type SupportedCurrency = 'USD' | 'EUR' | 'COP';

@Entity('user_settings')
export class UserSettings {
  @PrimaryGeneratedColumn() id: number;

  @Column() timezone: string;

  // Postgres ENUM column. `enumName: 'currency_enum'` binds this
  // column to the type created by migration 1800000000002
  // (bg_public.currency_enum) instead of TypeORM generating an
  // implicit per-column enum name. New TypeORM-generated INSERTs /
  // UPDATEs with a value outside the enum array will fail at the
  // ORM boundary (TypeORM's enum validator) AND at the storage
  // boundary (Postgres rejects unknown enum labels), so legacy codes
  // can't sneak back in via either path.
  @Column({
    type: 'enum',
    enum: ['USD', 'EUR', 'COP'],
    enumName: 'currency_enum',
  })
  currency: SupportedCurrency;

  @Column() locale: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @CreateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.settings)
  user: User;
}
