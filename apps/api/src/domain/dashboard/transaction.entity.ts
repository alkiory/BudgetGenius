import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: Date;

  @Column()
  description: string;

  @Column()
  category: string;

  @Column('numeric', {
    transformer: {
      to: (value: number) => value,
      from: (value: number | string) => {
        return Number(value);
      },
    },
  })
  amount: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  recurrence: string | null;

  @CreateDateColumn({ type: 'timestamp', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updatedAt' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.transactions)
  @JoinColumn({ name: 'userId' })
  user: User;
}
