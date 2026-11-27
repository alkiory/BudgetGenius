/**
 * `SUPERADMIN_EMAIL` names the single operator account.
 *
 * Email signup does not verify mailbox ownership, so matching the address
 * alone must not promote a password-protected account: whoever registered it
 * first would inherit the backoffice. Those still have to prove ownership with
 * `SUPERADMIN_PASSWORD`.
 *
 * A social-only account has no local credential to compare — the identity
 * provider already verified the mailbox — so for those the configured email is
 * the ownership signal. Without that branch a Google operator could never be
 * promoted, which is how production ended up with a superadmin signing in as a
 * regular user.
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
    demoteSuperAdminsExcept: jest.fn().mockResolvedValue(0),
    createUser: jest.fn(),
  };
  const settings = { updateSettings: jest.fn() };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

  return {
    userRepository,
    seeder: new UserSeederService(
      userRepository as any,
      settings as any,
      logger as any,
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

  it('refuses to promote an account that does not own the configured password', async () => {
    const attackerHash = await bcrypt.hash('attacker-password', 4);
    const { seeder, userRepository } = buildSeeder(attackerHash, {
      authProvider: 'email',
    });

    await seeder.createDefaultUsers();

    expect(userRepository.setRole).not.toHaveBeenCalled();
  });

  it('promotes an existing account when the configured password matches', async () => {
    const ownerHash = await bcrypt.hash('operator-password', 4);
    const { seeder, userRepository } = buildSeeder(ownerHash, {
      authProvider: 'email',
    });

    await seeder.createDefaultUsers();

    expect(userRepository.setRole).toHaveBeenCalledWith(3, 'superadmin');
  });

  it('promotes a social-only account: the provider already verified the mailbox', async () => {
    const { seeder, userRepository } = buildSeeder(null);

    await seeder.createDefaultUsers();

    expect(userRepository.setRole).toHaveBeenCalledWith(3, 'superadmin');
  });

  it('promotes a social-only account even when SUPERADMIN_PASSWORD is unset', async () => {
    delete process.env.SUPERADMIN_PASSWORD;
    const { seeder, userRepository } = buildSeeder(null);

    await seeder.createDefaultUsers();

    expect(userRepository.setRole).toHaveBeenCalledWith(3, 'superadmin');
  });

  it('still refuses a passwordless account labelled as an email signup', async () => {
    const { seeder, userRepository } = buildSeeder(null, {
      authProvider: 'email',
    });

    await seeder.createDefaultUsers();

    expect(userRepository.setRole).not.toHaveBeenCalled();
  });

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

  it('demotes after promoting a social account, keeping the operator', async () => {
    const { seeder, userRepository } = buildSeeder(null);

    await seeder.createDefaultUsers();

    expect(userRepository.demoteSuperAdminsExcept).toHaveBeenCalledWith(3);
  });

  it('never demotes when the promotion was refused', async () => {
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
});
