import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UserDto } from './dto/user.dto';
import { CreateUserDto } from '@application/user/dto/create.dto';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';
import { LoggingService } from '@infrastructure/log/logger.service';
import { UserSettingsService } from '@application/user/user-settings.service';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepositoryImpl,
    private readonly logger: LoggingService,
    private readonly userSettingsService: UserSettingsService,
  ) { }

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

    try {
      await this.userSettingsService.getOrCreateSettings(userDtoResult.id);
      this.logger.log(
        `⚙️ Initialized pre-onboarding user_settings row for admin-created user ${userDto.email}`,
      );
    } catch (settingsErr) {
      this.logger.warn(
        `⚠️ Could not eagerly create user_settings for admin-created user ${userDto.email}: ${(settingsErr as Error).message
        }. Lazy fallback will still work on first GET /user-settings.`,
      );
    }

    return this.userRepository.save(userDtoResult);
  }

  async getAllUsers() {
    return this.userRepository.getAll();
  }

  async updateUser(id: string, updateUserDto: Partial<UserDto>) {
    if (updateUserDto.password === '') {
      throw new BadRequestException(
        '🛑 Password cannot be empty. Use the "forgot password" flow to remove password login.',
      );
    }

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
