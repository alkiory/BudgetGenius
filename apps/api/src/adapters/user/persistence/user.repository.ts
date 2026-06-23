import { Injectable, NotFoundException } from '@nestjs/common';
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
  }: Omit<UserDto, 'id' | 'isPremium'>): Promise<User> {
    const user = new User();

    user.name = name;
    user.surname = surname;
    user.email = email;
    user.password = password;
    user.role = role;
    user.authProvider = authProvider;
    // isPremium now defaults at the DB column level (see migration IspremiumDefaultTrue).

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
        // Phase 6.8 (Bug B): the `incomes` relation was removed in
        // Phase 4 (T4.1-T4.6). Eagerly loading it on `findById` throws
        // `EntityPropertyNotFoundError: Property "incomes" was not
        // found in "User"` whenever incomePage (or any page that calls
        // /api/auth/verify → loadUser → findById) mounts.
        relations: ['budgets', 'transactions'],
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
    // `repo.preload({ id, ...partial })` reads the row, builds a User
    // entity instance with the partial MERGED on top of the loaded
    // values (so `password` overwrites the existing hash in memory
    // BEFORE hooks fire), and returns the hydrated entity. The
    // subsequent `repo.save(preloaded)` then fires the User entity's
    // `@BeforeUpdate hashPassword` hook which bcrypt-hashes the new
    // plaintext — see `User.hashPassword` in
    // `apps/api/src/domain/user/user.entity.ts`.
    //
    // This is the TypeORM-idiomatic pattern for an UPDATE-with-hooks.
    // The previous `repo.update(id, partial)` ran a bare UPDATE
    // statement that BYPASSed hooks; service-layer callers compensated
    // by manually pre-hashing, which is the exact footgun that caused
    // the /profile password update 401-on-login bug. The hook is now
    // the single source of truth for password hashing — callers
    // forward plaintext and trust the entity.
    const preloaded = await this.repo.preload({ id, ...updateUserDto });
    if (!preloaded) {
      throw new NotFoundException(`⚠️ User with id ${id} not found`);
    }
    return this.repo.save(preloaded);
  }

  async deleteUser(id: number): Promise<void> {
    await this.repo.delete({ id });
  }
}
