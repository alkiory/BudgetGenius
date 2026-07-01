import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
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

  @ManyToOne(() => User, (user) => user.settings)
  user: User;
}
