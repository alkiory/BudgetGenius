import { Injectable } from '@nestjs/common';
import { UserDto } from '@application/user/dto/user.dto';
import { User } from '@domain/user/user.entity';
import { UserRepositoryPort } from '@domain/user/user.repository.port';
import { LoggingService } from '@infrastructure/log/logger.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UserRepositoryImpl implements UserRepositoryPort {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    private readonly logger: LoggingService,
  ) {}
  async createUser({
    name,
    surname,
    email,
    password,
    role,
    authProvider,
    isPremium,
  }: Omit<UserDto, 'id'>): Promise<User> {
    const user = new User();

    user.name = name;
    user.surname = surname;
    user.email = email;
    user.password = password;
    user.role = role;
    user.authProvider = authProvider;
    user.isPremium = isPremium;

    return this.save(user);
  }

  async save(user: UserDto): Promise<User> {
    const savedUser = await this.repo.save(user);
    return savedUser;
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.repo.findOne({ where: { email } });
      return user;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  async findById(id: number): Promise<User | null> {
    try {
      const user = await this.repo.findOne({
        where: { id },
        relations: [
          'budgets',
          'transactions',
          'savingGoals',
          'incomes',
          'goals',
        ],
      });
      return user;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  async getAll(): Promise<User[]> {
    const users = await this.repo.find();
    return users;
  }

  async updateToken(id: number, refreshToken: string): Promise<void> {
    await this.repo.update(id, { refreshToken });
  }

  async updateUser(id: number, updateUserDto: Partial<UserDto>): Promise<User> {
    await this.repo.update(id, updateUserDto);
    return this.findById(id);
  }

  async deleteUser(id: number): Promise<void> {
    await this.repo.delete({ id });
  }
}
