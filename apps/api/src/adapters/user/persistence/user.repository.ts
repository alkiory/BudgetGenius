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
    // ── ENTITY-HOOK BYPASS WARNING ──
    // `repo.update(id, partial)` runs a bare UPDATE statement and does
    // NOT fire `@BeforeInsert` / `@BeforeUpdate` hooks on the entity. The
    // User entity relies on those hooks to bcrypt-hash the password.
    //
    // CURRENT PRE-HASH CONSUMER: `AuthService.resetPassword` in
    // `apps/api/src/application/auth/auth.service.ts` pre-hashes with
    // `bcrypt.hash(plain, 10)` before passing `{ password: hash }`
    // through here. Pre-comment code passed plaintext and ended up with
    // a literal plaintext password in MySQL — a critical silent-
    // corruption bug.
    //
    // IF YOU EVER REFACTOR THIS METHOD to use `repo.save(entityInstance)`
    // instead of `repo.update(id, partial)`, REMOVE the manual
    // `bcrypt.hash()` call in `AuthService.resetPassword` — otherwise
    // the password will be double-hashed and login will silently fail
    // (`bcrypt.compare(plaintext, doublyHashed)` returns false).
    await this.repo.update(id, updateUserDto);
    return this.findById(id);
  }

  async deleteUser(id: number): Promise<void> {
    await this.repo.delete({ id });
  }
}
