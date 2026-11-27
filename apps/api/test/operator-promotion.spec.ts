/**
 * The JWT carries the role and `JwtStrategy` does not re-read it from the
 * database, so the operator role has to be granted *before* the session is
 * issued. Promoting only in the boot seeder is not enough either: a Google
 * account is usually created by its first sign-in, long after boot.
 *
 * These tests pin the ordering, because getting it wrong is invisible — the
 * promotion lands in the database while the token keeps saying "user".
 */

import * as bcrypt from 'bcryptjs';
import { AuthService } from '@application/auth/auth.service';

const OPERATOR_EMAIL = 'operator@example.com';

const buildService = (options: { password?: string | null } = {}) => {
  const { password = null } = options;
  const user: any = {
    id: 5,
    email: OPERATOR_EMAIL,
    role: 'user',
    password,
    authProvider: password ? 'email' : 'google',
  };
  const userRepository = {
    setRole: jest.fn().mockResolvedValue(undefined),
    findByEmail: jest.fn().mockResolvedValue(user),
  };
  const redisService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    delete: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
  };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

  const service = new AuthService(
    userRepository as any,
    { sign: jest.fn().mockReturnValue('signed-token') } as any,
    redisService as any,
    logger as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  return { service, user, userRepository };
};

describe('operator promotion at sign-in', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SUPERADMIN_EMAIL: `  ${OPERATOR_EMAIL.toUpperCase()}  `,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('promotes the configured Google address and signs the session with it', async () => {
    const { service, user, userRepository } = buildService();
    jest.spyOn(service as any, 'validateOAuthUser').mockResolvedValue(user);
    const issueSession = jest.spyOn(service as any, 'issueSession');

    const session = await service.oauthLogin({
      email: OPERATOR_EMAIL,
      name: 'Operator',
    });

    expect(userRepository.setRole).toHaveBeenCalledWith(5, 'superadmin');
    expect(session.userEntity.role).toBe('superadmin');
    expect(issueSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5, role: 'superadmin' }),
    );
  });

  it('does not touch an account with a different address', async () => {
    const { service, user, userRepository } = buildService();
    user.email = 'someone-else@example.com';
    jest.spyOn(service as any, 'validateOAuthUser').mockResolvedValue(user);

    const session = await service.oauthLogin({
      email: user.email,
      name: 'Someone Else',
    });

    expect(userRepository.setRole).not.toHaveBeenCalled();
    expect(session.userEntity.role).toBe('user');
  });

  it('grants nothing when SUPERADMIN_EMAIL is not configured', async () => {
    delete process.env.SUPERADMIN_EMAIL;
    const { service, user, userRepository } = buildService();
    jest.spyOn(service as any, 'validateOAuthUser').mockResolvedValue(user);

    await service.oauthLogin({ email: OPERATOR_EMAIL, name: 'Operator' });

    expect(userRepository.setRole).not.toHaveBeenCalled();
  });

  it('is idempotent for an account that is already the operator', async () => {
    const { service, user, userRepository } = buildService();
    user.role = 'superadmin';
    jest.spyOn(service as any, 'validateOAuthUser').mockResolvedValue(user);

    await service.oauthLogin({ email: OPERATOR_EMAIL, name: 'Operator' });

    expect(userRepository.setRole).not.toHaveBeenCalled();
  });

  it('also promotes on a password login, before the token is signed', async () => {
    const { service, user, userRepository } = buildService({
      password: '$2a$04$stored-hash',
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    const issueSession = jest.spyOn(service as any, 'issueSession');

    await service.login(OPERATOR_EMAIL, 'operator-password');

    expect(userRepository.setRole).toHaveBeenCalledWith(5, 'superadmin');
    expect(user).toHaveProperty('role', 'superadmin');
    expect(issueSession).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'superadmin' }),
    );
  });
});
