/**
 * The JWT carries the role and `JwtStrategy` does not re-read it from the
 * database, so the operator role has to be granted *before* the session is
 * issued.
 *
 * It is granted only from the social sign-in, where the identity provider has
 * just proved the mailbox. A password login proves a password, not ownership:
 * signup never verified the address, so promoting there would hand the
 * backoffice to whoever registered it first.
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
    clearPassword: jest.fn().mockResolvedValue(undefined),
    demoteSuperAdminsExcept: jest.fn().mockResolvedValue([]),
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
    { current: jest.fn().mockResolvedValue(0) } as any,
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

  it('removes a password registered before the provider proved the address', async () => {
    const { service, user, userRepository } = buildService({
      password: '$2a$04$squatter-hash',
    });
    jest.spyOn(service as any, 'validateOAuthUser').mockResolvedValue(user);

    const session = await service.oauthLogin({
      email: OPERATOR_EMAIL,
      name: 'Operator',
    });

    // The local credential is dropped before the role is granted, and the
    // session it could have opened is revoked with it.
    expect(userRepository.clearPassword).toHaveBeenCalledWith(5);
    expect(userRepository.setRole).toHaveBeenCalledWith(5, 'superadmin');
    expect(session.userEntity.role).toBe('superadmin');
  });

  it('revokes the refresh token that the cleared password could have opened', async () => {
    const { service, user } = buildService({
      password: '$2a$04$squatter-hash',
    });
    jest.spyOn(service as any, 'validateOAuthUser').mockResolvedValue(user);
    const invalidate = jest.spyOn(service, 'invalidateRefreshToken');

    await service.oauthLogin({ email: OPERATOR_EMAIL, name: 'Operator' });

    expect(invalidate).toHaveBeenCalledWith(5);
  });

  it('leaves the password of a non-operator address alone', async () => {
    const { service, user, userRepository } = buildService({
      password: '$2a$04$someone-else',
    });
    user.email = 'someone-else@example.com';
    jest.spyOn(service as any, 'validateOAuthUser').mockResolvedValue(user);

    await service.oauthLogin({ email: user.email, name: 'Someone' });

    expect(userRepository.clearPassword).not.toHaveBeenCalled();
  });

  it('still signs the verified owner in when the cleanup fails', async () => {
    const { service, user, userRepository } = buildService({
      password: '$2a$04$squatter-hash',
    });
    userRepository.clearPassword.mockRejectedValueOnce(new Error('db down'));
    jest.spyOn(service as any, 'validateOAuthUser').mockResolvedValue(user);

    const session = await service.oauthLogin({
      email: OPERATOR_EMAIL,
      name: 'Operator',
    });

    // Fail-open on purpose: the cleanup retries next sign-in, while denying
    // this one would lock out the owner and keep the squatter's access.
    expect(session.userEntity.role).toBe('superadmin');
  });

  it('retires the previous operator in the same sign-in (handover)', async () => {
    const { service, user, userRepository } = buildService();
    jest.spyOn(service as any, 'validateOAuthUser').mockResolvedValue(user);

    await service.oauthLogin({ email: OPERATOR_EMAIL, name: 'Operator' });

    expect(userRepository.demoteSuperAdminsExcept).toHaveBeenCalledWith(5);
  });

  it('revokes the refresh token of every demoted operator', async () => {
    const { service, user, userRepository } = buildService();
    userRepository.demoteSuperAdminsExcept.mockResolvedValueOnce([9, 11]);
    jest.spyOn(service as any, 'validateOAuthUser').mockResolvedValue(user);
    const invalidate = jest.spyOn(service, 'invalidateRefreshToken');

    await service.oauthLogin({ email: OPERATOR_EMAIL, name: 'Operator' });

    // A demoted account that keeps its refresh token would rotate back into
    // a `superadmin` access token on the next call.
    expect(invalidate).toHaveBeenCalledWith(9);
    expect(invalidate).toHaveBeenCalledWith(11);
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
    expect(userRepository.demoteSuperAdminsExcept).not.toHaveBeenCalled();
    expect(session.userEntity.role).toBe('user');
  });

  it('grants nothing when SUPERADMIN_EMAIL is not configured', async () => {
    delete process.env.SUPERADMIN_EMAIL;
    const { service, user, userRepository } = buildService();
    jest.spyOn(service as any, 'validateOAuthUser').mockResolvedValue(user);

    await service.oauthLogin({ email: OPERATOR_EMAIL, name: 'Operator' });

    expect(userRepository.setRole).not.toHaveBeenCalled();
    expect(userRepository.demoteSuperAdminsExcept).not.toHaveBeenCalled();
  });

  it('is idempotent for an account that is already the operator', async () => {
    const { service, user, userRepository } = buildService();
    user.role = 'superadmin';
    jest.spyOn(service as any, 'validateOAuthUser').mockResolvedValue(user);

    await service.oauthLogin({ email: OPERATOR_EMAIL, name: 'Operator' });

    expect(userRepository.setRole).not.toHaveBeenCalled();
  });

  it('never promotes from a password login — signup does not verify the mailbox', async () => {
    const { service, user, userRepository } = buildService({
      password: '$2a$04$stored-hash',
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    const issueSession = jest.spyOn(service as any, 'issueSession');

    const session = await service.login(OPERATOR_EMAIL, 'attacker-chosen');

    expect(userRepository.setRole).not.toHaveBeenCalled();
    expect(session.user.role).toBe('user');
    expect(issueSession).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'user' }),
    );
  });
});
