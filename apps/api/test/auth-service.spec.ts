import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '@application/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';
import { LoggingService } from '@infrastructure/log/logger.service';
import { RedisService } from '@infrastructure/config/redis.service';
import { PasswordResetRepository } from '@adapters/auth/persistence/password-reset.repository';
import { User } from '@domain/user/user.entity';

import * as bcrypt from 'bcryptjs';
import { ForgotPasswordDto } from '@application/auth/dto/forgot-password.dto';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

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
  comparePassword: jest.fn((password) =>
    bcrypt.compare(password, user.password),
  ),
  hashPassword: jest.fn().mockResolvedValue(true),
  createdAt: new Date(),
  updatedAt: new Date(),
  transactions: [],
  budgets: [],
  expenseCategories: [],
  savingGoals: [],
  overviews: [],
  settings: [],
  incomes: [],
  goals: [],
};

describe('AuthService', () => {
  let authService: AuthService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let userRepository: UserRepositoryImpl;

  beforeEach(async () => {
    const jwtServiceMock = {
      sign: jest.fn(() => 'mock-access-token'),
    };
    const redisServiceMock = {
      set: jest.fn(() => Promise.resolve()),
    };
    const userRepositoryMock = {
      findByEmail: jest.fn().mockResolvedValue(user),
    };
    // Remove the comparePassword mock function
    delete user.comparePassword;
    const passwordResetRepositoryMock = {
      saveToken: jest.fn().mockResolvedValue({}),
    };
    const loggerMock = {
      log: jest.fn(),
    };
    const dataSourceMock = {
      query: jest.fn(),
      createQueryRunner: jest.fn(),
    };
    const configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        return undefined;
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: UserRepositoryImpl, useValue: userRepositoryMock },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: LoggingService, useValue: loggerMock },
        {
          provide: PasswordResetRepository,
          useValue: passwordResetRepositoryMock,
        },
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userRepository = module.get<UserRepositoryImpl>(UserRepositoryImpl);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  it('should login successfully in development mode (password validation skipped)', async () => {
    const result = await authService.login(user.email, user.password);
    expect(result).toHaveProperty('accessToken', 'mock-access-token');
    expect(result).toHaveProperty('refreshToken', 'mock-access-token');
    expect(result).toHaveProperty('user');
    expect(result.user.email).toBe(user.email);
  });

  it('should login successfully even with wrong password in development mode', async () => {
    const result = await authService.login(user.email, 'wrong-password');
    expect(result).toHaveProperty('accessToken', 'mock-access-token');
    expect(result).toHaveProperty('refreshToken', 'mock-access-token');
  });

  it('should reset password', async () => {
    const result = await authService.requestPasswordReset(
      user.email as unknown as ForgotPasswordDto,
    );
    expect(result).toEqual({ message: '📨 Recovery link sent to your email' });
  });
});
