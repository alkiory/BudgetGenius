import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
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
  // isPremium is dormant for MVP launch; defaults to true at the DB column level.
  // Kept in the mock so the literal satisfies the `User` type (T3.13 backward-compat).
  isPremium: true,
  comparePassword: jest.fn(),
  hashPassword: jest.fn(),
  createdAt: new Date(),
  updatedAt: new Date(),
  transactions: [],
  budgets: [],
  expenseCategories: [],
  overviews: [],
  settings: [],
  // [PHASE 4 REMOVED — DO NOT RESTORE] `incomes: []` is gone; see rpi/income-redundancy/plan.md.
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
    .mockImplementation((id, user) =>
      Promise.resolve({ id, ...user, email: user.email ?? user.email }),
    ),
  deleteUser: jest.fn().mockImplementation((id) => Promise.resolve(id)),
});

describe('UserService', () => {
  let userService: UserService;
  let userRepository;
  // Android APK audit, 2026-06: see comment below in the providers
  // block about why UserSettingsService is now required at the test
  // module level. Surface as a module-scoped binding so per-test
  // spies (`mockResolvedValueOnce`, etc.) can target the same
  // instance that UserService sees.
  let userSettingsServiceMock: { getOrCreateSettings: jest.Mock };

  beforeEach(async () => {
    userSettingsServiceMock = {
      getOrCreateSettings: jest.fn().mockResolvedValue({
        id: 1,
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en-US',
        hasCompletedOnboarding: false,
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepositoryImpl, useFactory: mockUserRepository },
        {
          provide: LoggingService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
        {
          // Android APK audit, 2026-06: UserService.createUser now
          // eagerly calls getOrCreateSettings to seed a pre-onboarding
          // user_settings row for admin-created users. The mock below
          // mirrors the auth-service.spec.ts fixture (matching shape,
          // matching module-scoped laziness) so per-test spies can
          // targeted-stub out the response without touching the DB.
          provide: UserSettingsService,
          useValue: {
            getOrCreateSettings: jest.fn().mockResolvedValue({
              id: 1,
              timezone: 'UTC',
              currency: 'USD',
              locale: 'en-US',
              hasCompletedOnboarding: false,
            }),
          },
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
    userRepository = module.get<UserRepositoryImpl>(UserRepositoryImpl);
    userSettingsServiceMock = module.get<UserSettingsService>(
      UserSettingsService,
    ) as any;
  });

  // `jest.spyOn(bcrypt, 'hash')` leaks across tests by default (Jest does
  // not auto-restore `spyOn` mocks — it only auto-restores `jest.fn()` and
  // auto-mocks via `automock`). Restore here so any future test that
  // relies on real bcrypt inside the entity hook still gets it.
  afterEach(() => {
    jest.restoreAllMocks();
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

    // The hook fires when `createUser` calls `repo.save(user)` with a
    // real `User` instance — we mock `save` here so the hook isn't
    // exercised; the standalone `apps/api/test/user-entity.spec.ts`
    // covers the hook body directly.
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
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(result.password).toBe('hashed_password');
    expect(userRepository.save).toHaveBeenCalled();
  });

  it('should find a user by email', async () => {
    const foundUser = await userService.getUserByEmail(user.email);

    expect(foundUser).toEqual(user);
    expect(userRepository.findByEmail).toHaveBeenCalledWith(user.email);
  });

  it('should update a user', async () => {
    const updatedUserDto = {
      id: user.id,
      name: 'Updated User',
      surname: 'Updated User',
      email: 'test2@test.com',
      // Plaintext — the @BeforeUpdate hook in userRepositoryImpl
      // bcrypt-hashes it before the SQL UPDATE runs.
      password: 'NewPl4in!Password',
      authProvider: user.authProvider as 'email',
      role: user.role,
      refreshToken: null,
    };
    const id = user.id;
    userRepository.updateUser.mockResolvedValue({ id, ...updatedUserDto });
    const updatedUser = await userService.updateUser(
      String(id),
      updatedUserDto,
    );
    expect(updatedUser).toEqual({ id, ...updatedUserDto });
  });

  // The service must NOT pre-hash the password. Hashing lives in the User
  // entity's @BeforeUpdate hook (fired inside userRepository.updateUser
  // via `repo.preload + repo.save`). The service is a thin pass-through
  // so a future caller can't accidentally double-hash or forget to hash.
  // The hook's behavior itself is covered in
  // `apps/api/test/user-entity.spec.ts`.
  it('should forward the plaintext password untouched to userRepository.updateUser', async () => {
    const plaintext = 'NewPl4in!Password';
    userRepository.updateUser.mockResolvedValue({
      id: user.id,
      email: user.email,
      password: plaintext,
    });

    await userService.updateUser(String(user.id), { password: plaintext });

    const [, updateArg] = (userRepository.updateUser as jest.Mock).mock
      .calls[0];
    // The service forwards the password unchanged. The hook at the
    // repository layer is what hashes it.
    expect(updateArg.password).toBe(plaintext);
  });

  // When the caller does NOT touch the password field, the partial
  // passes through verbatim. The hook only fires for fields it
  // recognises; if `password` is undefined the hook treats the
  // existing (already-hashed) value as a no-op.
  it('should leave the password untouched when updateUser is called without a password', async () => {
    userRepository.updateUser.mockResolvedValue({
      id: user.id,
      email: user.email,
    });

    await userService.updateUser(String(user.id), { name: 'Renamed Only' });

    const [, updateArg] = (userRepository.updateUser as jest.Mock).mock
      .calls[0];
    expect(updateArg.password).toBeUndefined();
    expect(updateArg.name).toBe('Renamed Only');
  });

  // Empty-string passwords must be rejected BEFORE delegation. The
  // hook's truthy-check (`if (this.password)`) treats `''` as "no
  // password" and would otherwise overwrite a real hash with the
  // literal empty string.
  it('should reject an empty-string password with BadRequestException', async () => {
    await expect(
      userService.updateUser(String(user.id), { password: '' }),
    ).rejects.toThrow('🛑 Password cannot be empty');
    expect(userRepository.updateUser).not.toHaveBeenCalled();
  });

  // The repository throws NotFoundException when `repo.preload` returns
  // null (the user was deleted between the controller's id check and the
  // service call). The service must surface it without re-running the
  // call.
  it('should surface NotFoundException from userRepository.updateUser when the target user no longer exists', async () => {
    userRepository.updateUser.mockRejectedValue(
      new NotFoundException('⚠️ User not found'),
    );

    await expect(
      userService.updateUser(String(user.id), { name: 'Renamed' }),
    ).rejects.toThrow('⚠️ User not found');
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
