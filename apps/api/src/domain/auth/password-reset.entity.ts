import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn()
  id: string;

  @Column()
  email: string;

  @Column()
  token: string;

  @CreateDateColumn()
  createdAt: Date;
}
