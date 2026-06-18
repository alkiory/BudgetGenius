import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { UserService } from '@application/user/user.service';
import { User } from '@domain/user/user.entity';
import { UserSeederService } from '@application/user/user-seeder.service';
import { LoggingService } from '@infrastructure/log/logger.service';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';
import { UserSettingsService } from '@application/user/user-settings.service';

const user: User = {
  id: 1,
  name: 'Test User',
  surname: 'Test User',
  email: 'test@test.com',
  password: '#Test123',
  authProvider: 'email',
  role: 'user',
  refreshToken: null,
  isPremium: false,
  comparePassword: jest.fn(),
  hashPassword: jest.fn(),
  createdAt: new Date(),
  updatedAt: new Date(),
  transactions: [],
  budgets: [],
  expenseCategories: [],
  overviews: [],
  settings: [],
  incomes: [],
  goals: [],
};

const mockUserRepository = () => ({
  create: jest.fn(),
  save: jest
    .fn()
    .mockImplementation((user) => Promise.resolve({ id: 3, ...user })),
  findOne: jest.fn(),
  findByEmail: jest
    .fn()
    .mockImplementation((email) =>
      Promise.resolve(email === user.email ? { ...user } : undefined),
    ),
  findById: jest
    .fn()
    .mockImplementation((id) =>
      Promise.resolve(id === user.id ? { ...user } : undefined),
    ),
  createUser: jest.fn().mockImplementation((user) => Promise.resolve(user)),
  getUserByEmail: jest.fn(),
  getAll: jest.fn().mockImplementation(() => Promise.resolve([user])),
  updateUser: jest
    .fn()
    .mockImplementation((id, user) => Promise.resolve({ id, user })),
  deleteUser: jest.fn().mockImplementation((id) => Promise.resolve(id)),
});

describe('UserService', () => {
  let userService: UserService;
  let userRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepositoryImpl, useFactory: mockUserRepository },
        {
          provide: LoggingService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
    userRepository = module.get<UserRepositoryImpl>(UserRepositoryImpl);
  });

  it('should be defined', () => {
    expect(userService).toBeDefined();
  });

  it('should create a user with a hashed password', async () => {
    const userDto = {
      name: user.name,
      email: user.email,
      password: user.password,
      authProvider: user.authProvider,
      role: user.role,
    };

    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_password' as never);
    userRepository.create.mockReturnValue({ id: 3, ...userDto });
    userRepository.save.mockResolvedValue({
      ...userDto,
      password: 'hashed_password',
    });

    const result = await userService.createUser({
      name: user.name,
      surname: user.surname,
      email: user.email,
      password: user.password,
      authProvider: user.authProvider as 'email',
      role: user.role,
      isPremium: user.isPremium,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(result.password).toBe('hashed_password');
    expect(userRepository.save).toHaveBeenCalled();
  });

  it('should find a user by email', async () => {
    userRepository.findOne.mockResolvedValue(user);

    const foundUser = await userService.getUserByEmail(user.email);

    expect(foundUser).toEqual(user);
    expect(userRepository.findByEmail).toHaveBeenCalledWith(user.email);
  });

  it('should get all users', async () => {
    const users = await userService.getAllUsers();
    expect(users).toEqual([user]);
  });

  it('should update a user', async () => {
    const updatedUserDto = {
      id: user.id,
      name: 'Updated User',
      surname: 'Updated User',
      email: 'test2@test.com',
      password: 'test1234',
      authProvider: user.authProvider as 'email',
      role: user.role,
      refreshToken: null,
      isPremium: false,
    };
    const id = user.id;
    userRepository.updateUser.mockResolvedValue({ id, ...updatedUserDto });
    const updatedUser = await userService.updateUser(String(id), updatedUserDto);
    expect(updatedUser).toEqual({ id, ...updatedUserDto });
  });

  it('should delete a user', async () => {
    const id = user.id;
    userRepository.deleteUser.mockResolvedValue(id);
    const deletedUser = await userService.deleteUser(id);
    expect(deletedUser).toEqual(id);
  });
});

describe('UserSeederService - seeder', () => {
  let userSeederService: UserSeederService;
  let userRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSeederService,
        LoggingService,
        { provide: UserRepositoryImpl, useFactory: mockUserRepository },
        {
          provide: UserSettingsService,
          useValue: {
            createDefaultSettings: jest.fn().mockResolvedValue(undefined),
            updateSettings: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    userSeederService = module.get<UserSeederService>(UserSeederService);
    userRepository = module.get<UserRepositoryImpl>(UserRepositoryImpl);
  });

  it('should be defined', () => {
    expect(userSeederService).toBeDefined();
  });

  it('should create a default user', async () => {
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_password' as never);

    await userSeederService.createDefaultUsers();
    expect(userRepository.save).toHaveBeenCalledTimes(2);
  });
});
