import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UserDto } from './dto/user.dto';
import { CreateUserDto } from '@application/user/dto/create.dto';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';
import { LoggingService } from '@infrastructure/log/logger.service';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepositoryImpl,
    private readonly logger: LoggingService,
  ) {}

  async getById(id: number) {
    return this.userRepository.findById(id);
  }

  async register(
    name: string,
    surname: string,
    email: string,
    password: string,
    rol: string,
    authProvider: 'email' | 'google',
  ) {
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new UnprocessableEntityException('User already exists');
    }

    this.logger.log(`User ${email} registered successfully`);
    return this.userRepository.createUser({
      name,
      surname,
      email,
      password,
      role: rol,
      authProvider,
      refreshToken: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async getUserByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  async createUser(userDto: CreateUserDto): Promise<UserDto> {
    const user = await this.userRepository.createUser({
      name: userDto.name,
      surname: userDto.surname,
      email: userDto.email,
      password: userDto.password,
      role: userDto.role,
      authProvider: userDto.authProvider,
      refreshToken: null,
      createdAt: userDto.createdAt,
      updatedAt: userDto.updatedAt,
    });

    if (!user) {
      throw new UnprocessableEntityException('User already exists');
    }

    // Create the user object to save in the database.
    // isPremium now defaults to `true` at the DB column level (see migration
    // IspremiumDefaultTrue). We use a defensive fallback because the in-memory
    // User entity has not yet been rehydrated right after .save().
    const userDtoResult: UserDto = {
      id: user.id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      password: user.password,
      role: user.role,
      refreshToken: user.refreshToken,
      authProvider: user.authProvider,
      isPremium: user.isPremium ?? true,
    };

    this.logger.log(`User ${userDto.email} created successfully`);
    return this.userRepository.save(userDtoResult);
  }

  async getAllUsers() {
    return this.userRepository.getAll();
  }

  async updateUser(id: string, updateUserDto: Partial<UserDto>) {
    // Reject empty-string passwords BEFORE delegation. The User entity's
    // @BeforeUpdate hashPassword hook treats `''` as falsy and skips the
    // hash, so a literal empty string reaching the repo would silently
    // overwrite a real hash with `''`. Login then fails because
    // `bcrypt.compare(plaintext, '')` is always false.
    if (updateUserDto.password === '') {
      throw new BadRequestException(
        '🛑 Password cannot be empty. Use the "forgot password" flow to remove password login.',
      );
    }

    // Forward the payload unchanged. `userRepository.updateUser` runs
    // `repo.preload + repo.save` which fires the User entity's
    // `@BeforeUpdate hashPassword` hook — bcrypt is the hook's job, not
    // ours, so a future caller can't forget to hash. `updatedAt` is
    // handled by TypeORM's @UpdateDateColumn automatically.
    const updated = await this.userRepository.updateUser(
      Number(id),
      updateUserDto,
    );

    this.logger.log(`User ${updated.email} updated successfully`);
    return updated;
  }

  async deleteUser(id: number) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      return { message: 'User not found or already deleted' };
    }
    return this.userRepository.deleteUser(id);
  }
}
