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
  // isPremium is dormant for MVP launch; defaults to true at the DB column level.
  // Kept in the mock so the literal satisfies the `User` type (T3.13 backward-compat).
  isPremium: true,
  comparePassword: jest.fn((password) =>
    bcrypt.compare(password, user.password),
  ),
  hashPassword: jest.fn().mockResolvedValue(true),
  createdAt: new Date(),
  updatedAt: new Date(),
  transactions: [],
  budgets: [],
  expenseCategories: [],
  overviews: [],
  settings: [],
  // [PHASE 4 REMOVED — DO NOT RESTORE] `incomes: []` is gone; see rpi/income-redundancy/plan.md. Income rows flow through `user.transactions` filtered by amount > 0.
};

describe('AuthService', () => {
  let authService: AuthService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let userRepository: UserRepositoryImpl;
  // Exposed so per-test spies (`mockResolvedValueOnce`, etc.) can target the same
  // instance that the AuthService is using for its Redis interactions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let redisServiceMock: any;

  beforeEach(async () => {
    // Mock bcrypt.compare so we don't need a real bcrypt hash in the fixture.
    // Default behavior validates the password as correct.
    jest
      .spyOn(bcrypt, 'compare')
      .mockImplementation((() => Promise.resolve(true)) as never);

    const jwtServiceMock = {
      sign: jest.fn(() => 'mock-access-token'),
    };
    redisServiceMock = {
      // No prior failed attempts by default (login:attempts:* absent).
      get: jest.fn(() => Promise.resolve(null)),
      set: jest.fn(() => Promise.resolve()),
      incr: jest.fn(() => Promise.resolve(1)),
      delete: jest.fn(() => Promise.resolve(1)),
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
      warn: jest.fn(),
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  it('should login successfully with the correct password', async () => {
    const result = await authService.login(user.email, user.password);
    expect(result).toHaveProperty('accessToken', 'mock-access-token');
    expect(result).toHaveProperty('refreshToken', 'mock-access-token');
    expect(result).toHaveProperty('user');
    expect(result.user.email).toBe(user.email);
  });

  it('should reject login when the password is incorrect', async () => {
    (bcrypt.compare as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(false),
    );

    await expect(
      authService.login(user.email, 'wrong-password'),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('should reject login for users without a password (social-only)', async () => {
    // Swap the repo response so the user has no password set (e.g. Google OAuth).
    userRepository.findByEmail = jest.fn().mockResolvedValueOnce({
      ...user,
      password: undefined,
    });

    await expect(
      authService.login(user.email, 'whatever'),
    ).rejects.toMatchObject({ status: 401 });
  });

  // ─── Login rate-limit (5 attempts per 15 min per email) ─────────────────

  it('should reject login with HTTP 429 when the per-email rate limit is exceeded', async () => {
    // Simulate that the email already had 5 failed attempts before this call.
    redisServiceMock.get.mockResolvedValueOnce('5');

    await expect(
      authService.login(user.email, user.password),
    ).rejects.toMatchObject({ status: 429 });

    // Critically, the rate-limited call must NOT reach bcrypt (no CPU burn for
    // brute-force attackers, no DB lookup either).
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(userRepository.findByEmail).not.toHaveBeenCalled();
  });

  it('should increment the attempts counter (with 15-min TTL) on wrong password', async () => {
    (bcrypt.compare as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(false),
    );

    await expect(authService.login(user.email, 'wrong')).rejects.toMatchObject({
      status: 401,
    });

    expect(redisServiceMock.incr).toHaveBeenCalledWith(
      `login:attempts:${user.email}`,
      15 * 60,
    );
  });

  it('should increment the attempts counter on user-not-found (anti-enumeration)', async () => {
    userRepository.findByEmail = jest.fn().mockResolvedValueOnce(null);

    await expect(
      authService.login('nobody@nowhere.com', 'whatever'),
    ).rejects.toMatchObject({ status: 401 });

    expect(redisServiceMock.incr).toHaveBeenCalledWith(
      'login:attempts:nobody@nowhere.com',
      15 * 60,
    );
  });

  it('should clear the attempts counter on successful login', async () => {
    await authService.login(user.email, user.password);

    expect(redisServiceMock.delete).toHaveBeenCalledWith(
      `login:attempts:${user.email}`,
    );
  });

  it('should reset password', async () => {
    const result = await authService.requestPasswordReset(
      user.email as unknown as ForgotPasswordDto,
    );
    expect(result).toEqual({ message: '📨 Recovery link sent to your email' });
  });

  // ─── Signup (idempotent + conflict on takeover) ─────────────────────────

  it('should create a new user on signup when the email is brand new', async () => {
    userRepository.findByEmail = jest.fn().mockResolvedValueOnce(null);
    userRepository.createUser = jest.fn().mockResolvedValueOnce({
      ...user,
      id: 42,
      email: 'new@user.com',
    });

    const result = await authService.signup({
      name: 'New',
      surname: 'User',
      email: 'new@user.com',
      password: 'whatever',
      authProvider: 'email',
      role: 'user',
    });

    expect(userRepository.createUser).toHaveBeenCalledTimes(1);
    expect(result.isNewUser).toBe(true);
    expect(result.user.email).toBe('new@user.com');
    expect(result.accessToken).toBe('mock-access-token');
    expect(result.refreshToken).toBe('mock-access-token');
  });

  it('should treat signup as an idempotent login when email+password match an existing user', async () => {
    // Default mock returns the existing user, and beforeEach mocks
    // bcrypt.compare to resolve true.
    const result = await authService.signup({
      name: user.name,
      surname: user.surname,
      email: user.email,
      password: user.password,
      authProvider: 'email',
      role: user.role,
    });

    expect(userRepository.createUser).toBeUndefined();
    expect(result.isNewUser).toBe(false);
    expect(result.user.email).toBe(user.email);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it('should reject signup with HTTP 409 when the email exists but the password does not match', async () => {
    (bcrypt.compare as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(false),
    );

    await expect(
      authService.signup({
        name: user.name,
        surname: user.surname,
        email: user.email,
        password: 'wrong-password',
        authProvider: 'email',
        role: user.role,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('should reject signup with HTTP 409 when the email exists without a password (social-only account)', async () => {
    userRepository.findByEmail = jest.fn().mockResolvedValueOnce({
      ...user,
      password: undefined,
    });

    await expect(
      authService.signup({
        name: user.name,
        surname: user.surname,
        email: user.email,
        password: 'whatever',
        authProvider: 'email',
        role: user.role,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
