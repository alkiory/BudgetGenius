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
import { ResetPasswordDto } from '@application/auth/dto/reset-password.dto';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ResendMailerService } from '@infrastructure/mail/resend-mailer.service';

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
      // Default implementation for `resetPassword` — mirrors the real one
      // (records the call) so per-test spies can inspect / override.
      updateUser: jest.fn().mockImplementation((_id, _partial) => Promise.resolve(user)),
    };
    // Remove the comparePassword mock function
    delete user.comparePassword;
    const passwordResetRepositoryMock = {
      saveToken: jest.fn().mockResolvedValue({}),
      findToken: jest.fn(),
      deleteToken: jest.fn().mockResolvedValue(undefined),
    };
    const loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const dataSourceMock = {
      query: jest.fn(),
      createQueryRunner: jest.fn(),
    };
    // ConfigService test double: returns values for keys the service reads.
    // `FRONTEND_URL` is what the password-reset flow uses to construct the
    // reset URL; tests assert on the exact value downstream.
    const configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'FRONTEND_URL')
          return 'https://budgetgeniusia.web.app,http://localhost:3001';
        return undefined;
      }),
    };
    // Resend mailer mock: resolves by default so the happy path doesn't
    // throw; per-test spies can simulate transport failure.
    const mailerMock = {
      sendPasswordReset: jest
        .fn()
        .mockResolvedValue('mock-message-id'),
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
        {
          provide: ResendMailerService,
          useValue: mailerMock,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userRepository = module.get<UserRepositoryImpl>(UserRepositoryImpl);

    // Stash the mailer mock so individual tests can swap behavior.
    (authService as any).mailer = mailerMock;
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

  // ─── forgot-password (sends through Resend, URL composition from FRONTEND_URL) ─

  it('should request password reset (forgot-password) and dispatch the email through the mailer', async () => {
    const result = await authService.requestPasswordReset(
      { email: user.email } as ForgotPasswordDto,
    );
    expect(result).toEqual({ message: '📨 Recovery link sent to your email' });

    // The mailer MUST receive the user-facing reset URL composed from
    // FRONTEND_URL[0] + a 64-hex-char token. Anything else means we're
    // sending bogus links to users.
    const mailer = (authService as any).mailer;
    expect(mailer.sendPasswordReset).toHaveBeenCalledTimes(1);
    const [to, url] = mailer.sendPasswordReset.mock.calls[0];
    expect(to).toBe(user.email);
    // Anchored regex for the full URL shape (randomBytes(32).hex == 64 chars).
    expect(url).toMatch(
      /^https:\/\/budgetgeniusia\.web\.app\/auth\/reset-password\?token=[a-f0-9]{64}$/,
    );
  });

  it('should propagate mailer transport failures (forgot-password is no longer a phantom success)', async () => {
    // Simulate Resend being down / API key invalid / 5xx — the original
    // production bug silently swallowed every email. With the fix in
    // place the controller surfaces a 5xx so users retry instead of
    // believing their email was sent.
    const mailer = (authService as any).mailer;
    mailer.sendPasswordReset.mockRejectedValueOnce(
      new Error('Resend transport error: invalid API key'),
    );

    await expect(
      authService.requestPasswordReset({
        email: user.email,
      } as ForgotPasswordDto),
    ).rejects.toThrow('Resend transport error');
  });

  it('should return the same 200-shaped response when the user does not exist (anti user-enumeration)', async () => {
    // After the post-fix contract, the response shape MUST be identical
    // whether the email belongs to a real account or not — an attacker
    // probing "which emails exist" is denied a status-code oracle. The
    // mailer MUST NOT have been called.
    userRepository.findByEmail = jest.fn().mockResolvedValueOnce(null);

    const result = await authService.requestPasswordReset({
      email: 'nobody@nowhere.com',
    } as ForgotPasswordDto);

    expect(result).toEqual({ message: '📨 Recovery link sent to your email' });
    const mailer = (authService as any).mailer;
    expect(mailer.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('should silently skip mailer for social-only (Google) users (anti user-enumeration + no surface-area expansion)', async () => {
    // Google-only users have no local password. Sending them a reset
    // email lets them silently set one without ever opting in, which
    // expands their auth surface. Treat them the same as unknown
    // emails: 200-shape response, no mailer call, AND no token written
    // — otherwise a future regression that silently writes a token for
    // social-only users would still pass this test.
    userRepository.findByEmail = jest.fn().mockResolvedValueOnce({
      ...user,
      authProvider: 'google',
      password: null,
    });

    const result = await authService.requestPasswordReset({
      email: user.email,
    } as ForgotPasswordDto);

    expect(result).toEqual({ message: '📨 Recovery link sent to your email' });
    const mailer = (authService as any).mailer;
    expect(mailer.sendPasswordReset).not.toHaveBeenCalled();
    const pwdResetRepo = (authService as any).passwordResetRepository;
    expect(pwdResetRepo.saveToken).not.toHaveBeenCalled();
  });

  it('should reject forgot-password with HTTP 500 if FRONTEND_URL is missing', async () => {
    // Force the config double to return undefined for FRONTEND_URL.
    // (Bracket-notation access on the test-built service instance is how
    // we reach the private configService dependency.)
    (authService['configService'] as any).get.mockImplementation(
      (key: string) => (key === 'JWT_SECRET' ? 'test-secret' : undefined),
    );

    await expect(
      authService.requestPasswordReset({
        email: user.email,
      } as ForgotPasswordDto),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('should reject forgot-password with HTTP 500 if FRONTEND_URL is malformed (no scheme)', async () => {
    // Misconfigured value like `not-a-url` would still pass the
    // empty-string guard and ship an email with a broken link. The
    // service must surface a 500 so an operator notices instead of
    // silently spamming production with unclickable emails.
    (authService['configService'] as any).get.mockImplementation(
      (key: string) =>
        key === 'JWT_SECRET'
          ? 'test-secret'
          : key === 'FRONTEND_URL'
            ? 'not-a-url'
            : undefined,
    );

    await expect(
      authService.requestPasswordReset({
        email: user.email,
      } as ForgotPasswordDto),
    ).rejects.toMatchObject({ status: 500 });
  });

  // ─── reset-password (writes new hash, token TTL, cleanup) ──────────────

  it('should reset password: forward plaintext to repo (hook fires), write to user, delete token', async () => {
    const passwordResetRepositoryMock = (authService as any)
      .passwordResetRepository as any;

    // Token age inside the 1-hour TTL.
    passwordResetRepositoryMock.findToken.mockResolvedValueOnce({
      id: 'tok-1',
      email: user.email,
      token: 'validtoken-1234567890',
      createdAt: new Date(),
    });

    const result = await authService.resetPassword({
      token: 'validtoken-1234567890',
      newPassword: 'NewP4ssword!',
    } as ResetPasswordDto);

    expect(result).toEqual({ message: '🔑 Password reset successfully' });

    // updateUser MUST be called with the PLAINTEXT new password, NOT a
    // pre-hashed value. The User entity's @BeforeUpdate hook (fired
    // inside `userRepositoryImpl.updateUser` via `repo.preload +
    // repo.save`) is what now bcrypt-hashes the column value before
    // the SQL UPDATE runs — the service is a thin pass-through.
    // Hashing here too would double-hash and silently break login.
    expect(userRepository.updateUser).toHaveBeenCalledTimes(1);
    const [, updateArg] = (userRepository.updateUser as jest.Mock).mock.calls[0];
    expect(updateArg.password).toBe('NewP4ssword!');

    // Token must be deleted so it can't be reused.
    expect(passwordResetRepositoryMock.deleteToken).toHaveBeenCalledWith('tok-1');
  });

  it('should reject reset-password when the token is unknown', async () => {
    const passwordResetRepositoryMock = (authService as any)
      .passwordResetRepository as any;
    passwordResetRepositoryMock.findToken.mockResolvedValueOnce(null);

    await expect(
      authService.resetPassword({
        token: 'unknown-token',
        newPassword: 'whatever',
      } as ResetPasswordDto),
    ).rejects.toMatchObject({ status: 400 });

    // No write to the user MUST happen if we couldn't find the token.
    expect(userRepository.updateUser).not.toHaveBeenCalled();
  });

  it('should reject reset-password when the token is older than 1 hour', async () => {
    const passwordResetRepositoryMock = (authService as any)
      .passwordResetRepository as any;
    passwordResetRepositoryMock.findToken.mockResolvedValueOnce({
      id: 'tok-old',
      email: user.email,
      token: 'oldtoken-1234',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    });

    await expect(
      authService.resetPassword({
        token: 'oldtoken-1234',
        newPassword: 'whatever',
      } as ResetPasswordDto),
    ).rejects.toThrow('Reset token expired');

    // No write MUST happen on an expired token.
    expect(userRepository.updateUser).not.toHaveBeenCalled();
    // Best-effort cleanup of the dangling token.
    expect(passwordResetRepositoryMock.deleteToken).toHaveBeenCalledWith('tok-old');
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
