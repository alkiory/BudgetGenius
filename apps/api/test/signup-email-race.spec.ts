/**
 * Regression tests for audit finding S6 / task T0.8 — both account-creation
 * paths must answer the same thing when two concurrent requests claim one
 * address.
 *
 * `users.email` had no uniqueness, so two signups could both pass the
 * read-then-write pre-check and insert two rows. The UNIQUE index on
 * `LOWER(email)` (migration 1800000000009) makes the second INSERT fail with
 * SQLSTATE 23505; both `signup` and the Google path (`validateOAuthUser`) must
 * translate that into `409 Conflict`, not a 500 (email) or a 401 (Google).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AuthService } from '@application/auth/auth.service';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';
import { RedisService } from '@infrastructure/config/redis.service';
import { LoggingService } from '@infrastructure/log/logger.service';
import { PasswordResetRepository } from '@adapters/auth/persistence/password-reset.repository';
import { ResendMailerService } from '@infrastructure/mail/resend-mailer.service';
import { UserSettingsService } from '@application/user/user-settings.service';
import { User } from '@domain/user/user.entity';
import { TokenEpochService } from '@application/auth/token-epoch.service';

const uniqueViolation = () =>
  Object.assign(
    new Error(
      'duplicate key value violates unique constraint "UQ_users_lower_email"',
    ),
    { code: '23505', driverError: { code: '23505' } },
  );

/** Minimal QueryRunner surface used by `validateOAuthUser`. */
function makeRunner(manager: Record<string, jest.Mock>) {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    isTransactionActive: true,
    manager,
  };
}

describe('AuthService — concurrent same-email account creation', () => {
  let service: AuthService;
  let userRepository: { findByEmail: jest.Mock; createUser: jest.Mock };
  let dataSource: { createQueryRunner: jest.Mock };

  const emailDto = {
    name: 'Race',
    surname: 'Tester',
    email: 'race@example.com',
    password: '#Password123',
    authProvider: 'email' as const,
    role: 'user',
  };

  const googleProfile = {
    providerId: 'google-1',
    email: 'GooGle@Example.com',
    name: 'Google Tester',
  };

  beforeEach(async () => {
    userRepository = {
      findByEmail: jest.fn().mockResolvedValue(null),
      createUser: jest.fn(),
    };
    dataSource = { createQueryRunner: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepositoryImpl, useValue: userRepository },
        { provide: JwtService, useValue: { sign: jest.fn(() => 'token') } },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn().mockResolvedValue(undefined),
            incr: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: LoggingService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
        {
          provide: TokenEpochService,
          useValue: {
            current: jest.fn().mockResolvedValue(0),
            bump: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: PasswordResetRepository,
          useValue: { saveToken: jest.fn(), findToken: jest.fn() },
        },
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: ResendMailerService,
          useValue: { sendPasswordReset: jest.fn() },
        },
        {
          provide: UserSettingsService,
          useValue: { getOrCreateSettings: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('signup: answers 409 instead of 500 when the second INSERT hits the index', async () => {
    // Both requests read "email is free" before either writes — the race.
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.createUser
      .mockResolvedValueOnce({ id: 42, email: emailDto.email, role: 'user' })
      .mockRejectedValueOnce(uniqueViolation());

    const results = await Promise.allSettled([
      service.signup(emailDto),
      service.signup(emailDto),
    ]);

    expect(results[0].status).toBe('fulfilled');
    const loser = results[1] as PromiseRejectedResult;
    expect(loser.status).toBe('rejected');
    expect(loser.reason).toBeInstanceOf(ConflictException);
    expect((loser.reason as ConflictException).getStatus()).toBe(409);
  });

  it('google: answers 409 instead of 401 when the second INSERT hits the index', async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity, data) => ({ id: 43, ...data })),
      save: jest
        .fn()
        .mockResolvedValueOnce({ id: 43, email: 'google@example.com' })
        .mockRejectedValueOnce(uniqueViolation()),
    };
    const runner = makeRunner(manager);
    dataSource.createQueryRunner.mockReturnValue(runner);

    const results = await Promise.allSettled([
      service.validateOAuthUser(googleProfile),
      service.validateOAuthUser(googleProfile),
    ]);

    expect(results[0].status).toBe('fulfilled');
    const loser = results[1] as PromiseRejectedResult;
    expect(loser.status).toBe('rejected');
    expect(loser.reason).toBeInstanceOf(ConflictException);
    expect((loser.reason as ConflictException).getStatus()).toBe(409);
    // The losing transaction is rolled back before answering.
    expect(runner.rollbackTransaction).toHaveBeenCalled();

    // The Google lookup also compares the canonical form, so casing can never
    // split one account in two.
    expect(manager.findOne).toHaveBeenCalledWith(User, {
      where: { email: 'google@example.com' },
    });
  });

  it('does not disguise unrelated write failures as 409', async () => {
    const dbDown = Object.assign(new Error('connection terminated'), {
      code: '08006',
    });
    userRepository.createUser.mockRejectedValue(dbDown);

    await expect(service.signup(emailDto)).rejects.toBe(dbDown);
  });
});
