/**
 * `SUPERADMIN_EMAIL` names the single operator.
 *
 * Boot can prove ownership only with the account's local password: a matching
 * `SUPERADMIN_PASSWORD` promotes it, anything else leaves the row alone. A
 * passwordless (social) account is skipped — the profile endpoint lets its
 * owner rewrite `email` and `authProvider`, so the stored provider label
 * proves nothing — and receives the role on its next Google sign-in instead,
 * where the provider verifies the mailbox.
 *
 * The demotion of every other superadmin runs only after a password-verified
 * operator holds the role, so a refused promotion can never leave the product
 * with no operator at all.
 */

import * as bcrypt from 'bcryptjs';
import { UserSeederService } from '@application/user/user-seeder.service';

const OPERATOR_EMAIL = 'operator@example.com';

const buildSeeder = (
  storedPasswordHash: string | null,
  options: { role?: string; authProvider?: string } = {},
) => {
  const { role = 'user', authProvider = 'google' } = options;
  const userRepository = {
    findByEmail: jest.fn().mockResolvedValue({
      id: 3,
      email: OPERATOR_EMAIL,
      password: storedPasswordHash,
      role,
      authProvider,
    }),
    setRole: jest.fn().mockResolvedValue(undefined),
    demoteSuperAdminsExcept: jest.fn().mockResolvedValue([]),
    createUser: jest.fn(),
  };
  const settings = { updateSettings: jest.fn() };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const redis = { delete: jest.fn().mockResolvedValue(1) };

  return {
    userRepository,
    redis,
    seeder: new UserSeederService(
      userRepository as any,
      settings as any,
      logger as any,
      redis as any,
    ),
  };
};

describe('UserSeederService — superadmin promotion', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      SUPERADMIN_EMAIL: OPERATOR_EMAIL,
      SUPERADMIN_PASSWORD: 'operator-password',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('refuses an account that does not own the configured password', async () => {
    const attackerHash = await bcrypt.hash('attacker-password', 4);
    const { seeder, userRepository } = buildSeeder(attackerHash, {
      authProvider: 'email',
    });

    await seeder.createDefaultUsers();

    expect(userRepository.setRole).not.toHaveBeenCalled();
    expect(userRepository.demoteSuperAdminsExcept).not.toHaveBeenCalled();
  });

  it('promotes an existing account when the configured password matches', async () => {
    const ownerHash = await bcrypt.hash('operator-password', 4);
    const { seeder, userRepository } = buildSeeder(ownerHash, {
      authProvider: 'email',
    });

    await seeder.createDefaultUsers();

    expect(userRepository.setRole).toHaveBeenCalledWith(3, 'superadmin');
  });

  it('skips a social account: the role is granted on its next Google sign-in', async () => {
    const { seeder, userRepository } = buildSeeder(null);

    await seeder.createDefaultUsers();

    expect(userRepository.setRole).not.toHaveBeenCalled();
    expect(userRepository.demoteSuperAdminsExcept).not.toHaveBeenCalled();
  });

  it.each(['email', undefined])(
    'skips a passwordless account labelled authProvider=%s — the label is client-editable',
    async (authProvider) => {
      const { seeder, userRepository } = buildSeeder(null, { authProvider });

      await seeder.createDefaultUsers();

      expect(userRepository.setRole).not.toHaveBeenCalled();
      expect(userRepository.demoteSuperAdminsExcept).not.toHaveBeenCalled();
    },
  );

  it('leaves an account that is already the operator alone', async () => {
    const { seeder, userRepository } = buildSeeder(null, {
      role: 'superadmin',
    });

    await seeder.createDefaultUsers();

    expect(userRepository.setRole).not.toHaveBeenCalled();
  });

  it('demotes every other superadmin once the operator holds the role', async () => {
    const { seeder, userRepository } = buildSeeder(null, {
      role: 'superadmin',
    });

    await seeder.createDefaultUsers();

    expect(userRepository.demoteSuperAdminsExcept).toHaveBeenCalledWith(3);
  });

  it('demotes after promoting a password-verified operator', async () => {
    const ownerHash = await bcrypt.hash('operator-password', 4);
    const { seeder, userRepository } = buildSeeder(ownerHash, {
      authProvider: 'email',
    });

    await seeder.createDefaultUsers();

    expect(userRepository.demoteSuperAdminsExcept).toHaveBeenCalledWith(3);
  });

  it('never demotes when promotion was refused', async () => {
    const attackerHash = await bcrypt.hash('attacker-password', 4);
    const { seeder, userRepository } = buildSeeder(attackerHash, {
      authProvider: 'email',
    });

    await seeder.createDefaultUsers();

    expect(userRepository.demoteSuperAdminsExcept).not.toHaveBeenCalled();
  });

  it('never demotes when SUPERADMIN_EMAIL is not configured', async () => {
    delete process.env.SUPERADMIN_EMAIL;
    const { seeder, userRepository } = buildSeeder(null);

    await seeder.createDefaultUsers();

    expect(userRepository.demoteSuperAdminsExcept).not.toHaveBeenCalled();
  });

  it('revokes the refresh token of every account it demotes', async () => {
    const { seeder, userRepository, redis } = buildSeeder(null, {
      role: 'superadmin',
    });
    userRepository.demoteSuperAdminsExcept.mockResolvedValueOnce([9]);

    await seeder.createDefaultUsers();

    expect(redis.delete).toHaveBeenCalledWith('refreshToken:9');
  });
});
