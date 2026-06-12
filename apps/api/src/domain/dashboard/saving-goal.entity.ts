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

@Entity('saving_goals')
export class SavingGoal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('numeric', {
    transformer: {
      to: (value: number) => value,
      from: (value: number | string) => {
        return Number(value);
      },
    },
  })
  current: number;

  @Column('numeric', {
    transformer: {
      to: (value: number) => value,
      from: (value: number | string) => {
        return Number(value);
      },
    },
  })
  target: number;

  @Column('numeric', {
    transformer: {
      to: (value: number) => value,
      from: (value: number | string) => {
        return Number(value);
      },
    },
  })
  percentage: number;

  @Column({ type: 'date', nullable: true })
  targetDate: Date;

  @Column()
  category: string;

  @Column({ nullable: true })
  color: string;

  @CreateDateColumn({ type: 'timestamp', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updatedAt' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.savingGoals)
  @JoinColumn({ name: 'userId' })
  user: User;
}
