/**
 * Email signup does not verify mailbox ownership, so matching
 * SUPERADMIN_EMAIL alone must not promote an existing account: whoever
 * registered the address first would inherit the backoffice. Promotion now
 * requires the account password to match SUPERADMIN_PASSWORD.
 */

import * as bcrypt from 'bcryptjs';
import { UserSeederService } from '@application/user/user-seeder.service';

const OPERATOR_EMAIL = 'operator@example.com';

const buildSeeder = (storedPasswordHash: string | null, role = 'user') => {
  const userRepository = {
    findByEmail: jest.fn().mockResolvedValue({
      id: 3,
      email: OPERATOR_EMAIL,
      password: storedPasswordHash,
      role,
    }),
    setRole: jest.fn().mockResolvedValue(undefined),
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
    const { seeder, userRepository } = buildSeeder(attackerHash);

    await seeder.createDefaultUsers();

    expect(userRepository.setRole).not.toHaveBeenCalled();
  });

  it('promotes an existing account when the configured password matches', async () => {
    const ownerHash = await bcrypt.hash('operator-password', 4);
    const { seeder, userRepository } = buildSeeder(ownerHash);

    await seeder.createDefaultUsers();

    expect(userRepository.setRole).toHaveBeenCalledWith(3, 'superadmin');
  });

  it('refuses social-only accounts without a password', async () => {
    const { seeder, userRepository } = buildSeeder(null);

    await seeder.createDefaultUsers();

    expect(userRepository.setRole).not.toHaveBeenCalled();
  });
});
