import { UserDto } from '@application/user/dto/user.dto';
import { User } from './user.entity';

export interface UserRepositoryPort {
  createUser({
    name,
    surname,
    email,
    password,
    role,
    authProvider,
  }: Omit<UserDto, 'id' | 'isPremium'>): Promise<User>;

  findByEmail(email: string): Promise<User | null>;

  getAll(): Promise<User[]>;

  findById(id: number): Promise<User | null>;

  updateUser(id: number, updateUserDto: UserDto): Promise<User>;

  deleteUser(id: number): Promise<void>;

  save(user: UserDto): Promise<User>;
}
