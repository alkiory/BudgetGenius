import { Injectable, UnprocessableEntityException } from '@nestjs/common';
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
    isPremium: boolean,
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
      isPremium,
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
      isPremium: userDto.isPremium,
      createdAt: userDto.createdAt,
      updatedAt: userDto.updatedAt,
    });

    if (!user) {
      throw new UnprocessableEntityException('User already exists');
    }

    // Create the user object to save in the database
    const userDtoResult: UserDto = {
      id: user.id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      password: user.password,
      role: user.role,
      refreshToken: user.refreshToken,
      authProvider: user.authProvider,
      isPremium: user.isPremium,
    };

    this.logger.log(`User ${userDto.email} created successfully`);
    return this.userRepository.save(userDtoResult);
  }

  async getAllUsers() {
    return this.userRepository.getAll();
  }

  async updateUser(id: string, updateUserDto: Partial<UserDto>) {
    const user = await this.userRepository.findById(Number(id));

    this.logger.log(`User ${user.email} updated successfully`);

    return this.userRepository.updateUser(Number(id), {
      ...updateUserDto,
      updatedAt: new Date(),
    });
  }

  async deleteUser(id: number) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      return { message: 'User not found or already deleted' };
    }
    return this.userRepository.deleteUser(id);
  }
}
