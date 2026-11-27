/**
 * The catalogue exposes beta/disabled pages and internal modules to the
 * operator. That decision used to read `req.user.role`, a claim baked into the
 * JWT at sign-in — so a demoted account kept the private inventory for up to
 * seven days. The role must come from the row.
 */

import { AppCatalogService } from '@application/catalog/app-catalog.service';

const buildService = (storedRole: string | null) => {
  const modules = { find: jest.fn().mockResolvedValue([]) };
  const users = {
    findOne: jest
      .fn()
      .mockResolvedValue(
        storedRole === null ? null : { id: 7, role: storedRole },
      ),
  };

  return {
    service: new AppCatalogService(modules as any, users as any),
    modules,
    users,
  };
};

const firstQuery = (modules: { find: jest.Mock }) =>
  modules.find.mock.calls[0][0];

describe('AppCatalogService — role comes from the database', () => {
  it('serves only the public inventory to a demoted account', async () => {
    const { service, modules, users } = buildService('user');

    await service.findVisibleFor(7);

    expect(users.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7 } }),
    );
    expect(firstQuery(modules).where.status).toBe('active');
  });

  it('serves the full inventory to the stored operator', async () => {
    const { service, modules } = buildService('superadmin');

    await service.findVisibleFor(7);

    // The operator query has no `kind` allow-list; the public one always does.
    expect(firstQuery(modules).where.kind).toBeUndefined();
  });

  it('falls back to the public inventory when the account is gone', async () => {
    const { service, modules } = buildService(null);

    await service.findVisibleFor(7);

    expect(firstQuery(modules).where.status).toBe('active');
  });

  it('does not query for an anonymous caller', async () => {
    const { service, modules, users } = buildService('superadmin');

    await service.findVisibleFor(undefined);

    expect(users.findOne).not.toHaveBeenCalled();
    expect(firstQuery(modules).where.status).toBe('active');
  });
});
