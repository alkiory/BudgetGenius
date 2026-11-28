/**
 * The role travels inside the JWT and `JwtStrategy` does not re-read it, so a
 * token minted before a demotion keeps claiming `superadmin`, and a token
 * minted before a promotion keeps claiming `user`.
 *
 * The guard is the boundary that makes "only one operator" true for the
 * lifetime of the token, and it checks two things against the row: it says
 * `superadmin` *and* its address is the one in `SUPERADMIN_EMAIL`. The second
 * check is what survives a failed handover cleanup, when the former operator's
 * row still says `superadmin`.
 *
 * It reads the row for superadmin routes whatever the token claims. Deciding
 * from the token first locked the operator out of the backoffice for up to
 * seven days after a promotion: the menu appears (the profile is read from the
 * database) while every call answered 403.
 */

import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '@infrastructure/auth/guards/roles.guard';

const OPERATOR_EMAIL = 'operator@example.com';

const contextFor = (role: string, userId: number | undefined = 7) =>
  ({
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => ({ user: { userId, role } }) }),
  }) as any;

const noIdContext = (role = 'superadmin') =>
  ({
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  }) as any;

const anonymousContext = () =>
  ({
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => ({}) }),
  }) as any;

const buildGuard = (
  requiredRoles: string[] | undefined,
  stored?: { role: string; email: string },
) => {
  const reflector = { get: jest.fn().mockReturnValue(requiredRoles) };
  const users = {
    findOne: jest
      .fn()
      .mockResolvedValue(stored === undefined ? null : { id: 7, ...stored }),
  };

  return { guard: new RolesGuard(reflector as any, users as any), users };
};

describe('RolesGuard — superadmin', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      SUPERADMIN_EMAIL: OPERATOR_EMAIL,
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows the operator whose token was minted before the promotion', async () => {
    const { guard, users } = buildGuard(['superadmin'], {
      role: 'superadmin',
      email: OPERATOR_EMAIL,
    });

    await expect(guard.canActivate(contextFor('user'))).resolves.toBe(true);
    expect(users.findOne).toHaveBeenCalled();
  });

  it('rejects a token that still claims superadmin after a demotion', async () => {
    const { guard, users } = buildGuard(['superadmin'], {
      role: 'user',
      email: OPERATOR_EMAIL,
    });

    await expect(guard.canActivate(contextFor('superadmin'))).rejects.toThrow(
      ForbiddenException,
    );
    expect(users.findOne).toHaveBeenCalled();
  });

  it('rejects a leftover superadmin row that is not the configured address', async () => {
    const { guard } = buildGuard(['superadmin'], {
      role: 'superadmin',
      email: 'former-operator@example.com',
    });

    await expect(guard.canActivate(contextFor('superadmin'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects a token whose account no longer exists', async () => {
    const { guard } = buildGuard(['superadmin']);

    await expect(guard.canActivate(contextFor('superadmin'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects a token without a usable user id', async () => {
    const { guard, users } = buildGuard(['superadmin'], {
      role: 'superadmin',
      email: OPERATOR_EMAIL,
    });

    await expect(guard.canActivate(noIdContext())).rejects.toThrow(
      ForbiddenException,
    );
    expect(users.findOne).not.toHaveBeenCalled();
  });

  it('allows the configured account that holds the role', async () => {
    const { guard } = buildGuard(['superadmin'], {
      role: 'superadmin',
      email: OPERATOR_EMAIL.toUpperCase(),
    });

    await expect(guard.canActivate(contextFor('superadmin'))).resolves.toBe(
      true,
    );
  });

  it('denies the backoffice when SUPERADMIN_EMAIL is not configured', async () => {
    delete process.env.SUPERADMIN_EMAIL;
    const { guard } = buildGuard(['superadmin'], {
      role: 'superadmin',
      email: OPERATOR_EMAIL,
    });

    await expect(guard.canActivate(contextFor('superadmin'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects a regular user whose row carries no operator role', async () => {
    const { guard } = buildGuard(['superadmin'], {
      role: 'user',
      email: OPERATOR_EMAIL,
    });

    await expect(guard.canActivate(contextFor('user'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects an anonymous request', async () => {
    const { guard, users } = buildGuard(['superadmin']);

    await expect(guard.canActivate(anonymousContext())).rejects.toThrow(
      ForbiddenException,
    );
    expect(users.findOne).not.toHaveBeenCalled();
  });

  it('uses the token role for routes that do not require the operator', async () => {
    const { guard, users } = buildGuard(['admin']);

    await expect(guard.canActivate(contextFor('user'))).rejects.toThrow(
      ForbiddenException,
    );
    expect(users.findOne).not.toHaveBeenCalled();
  });

  it('passes through when the route requires no role', async () => {
    const { guard, users } = buildGuard(undefined);

    await expect(guard.canActivate(contextFor('user'))).resolves.toBe(true);
    expect(users.findOne).not.toHaveBeenCalled();
  });
});
