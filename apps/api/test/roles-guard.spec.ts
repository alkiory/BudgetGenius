/**
 * The role travels inside the JWT and `JwtStrategy` does not re-read it, so a
 * token minted before a demotion keeps claiming `superadmin`. The guard is the
 * boundary that makes "only one operator" true for the lifetime of the token,
 * not just in the database.
 */

import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '@infrastructure/auth/guards/roles.guard';

const contextFor = (role: string, userId = 7) =>
  ({
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => ({ user: { userId, role } }) }),
  }) as any;

const buildGuard = (
  requiredRoles: string[] | undefined,
  storedRole?: string,
) => {
  const reflector = { get: jest.fn().mockReturnValue(requiredRoles) };
  const users = {
    findOne: jest
      .fn()
      .mockResolvedValue(
        storedRole === undefined ? null : { id: 7, role: storedRole },
      ),
  };

  return { guard: new RolesGuard(reflector as any, users as any), users };
};

describe('RolesGuard — superadmin', () => {
  it('rejects a token that still claims superadmin after a demotion', async () => {
    const { guard, users } = buildGuard(['superadmin'], 'user');

    await expect(guard.canActivate(contextFor('superadmin'))).rejects.toThrow(
      ForbiddenException,
    );
    expect(users.findOne).toHaveBeenCalled();
  });

  it('rejects a token whose account no longer exists', async () => {
    const { guard } = buildGuard(['superadmin'], undefined);

    await expect(guard.canActivate(contextFor('superadmin'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows the account that holds the role in the database', async () => {
    const { guard } = buildGuard(['superadmin'], 'superadmin');

    await expect(guard.canActivate(contextFor('superadmin'))).resolves.toBe(
      true,
    );
  });

  it('rejects a regular user without querying the database', async () => {
    const { guard, users } = buildGuard(['superadmin'], 'superadmin');

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
