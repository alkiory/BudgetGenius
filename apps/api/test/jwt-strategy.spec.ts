/**
 * Access credentials are the only JWTs accepted by protected routes.
 *
 * The refresh token used to share the access token's claims, so a stolen
 * refresh credential worked as a seven-day bearer token; logout revocation
 * only covered the refresh endpoint. These tests pin the type check and the
 * Redis blacklist check.
 */

import {
  JwtStrategy,
  blacklistKeyForToken,
} from '@infrastructure/config/strategy/jwt.strategy';

const buildStrategy = (
  redisGet = jest.fn().mockResolvedValue(null),
  tokenEpoch = jest.fn().mockResolvedValue(0),
) =>
  new JwtStrategy(
    { get: jest.fn().mockReturnValue('test-secret') } as any,
    { get: redisGet } as any,
    { current: tokenEpoch } as any,
  );

const requestWith = (token: string) => ({
  cookies: { accessToken: token },
  headers: {},
});

const payload = {
  id: 7,
  email: 'user@example.com',
  role: 'user',
  typ: 'access',
};

describe('JwtStrategy session epoch', () => {
  it('accepts an access token signed at the current epoch', async () => {
    const strategy = buildStrategy(undefined, jest.fn().mockResolvedValue(3));

    await expect(
      strategy.validate(requestWith('access'), { ...payload, epoch: 3 }),
    ).resolves.toEqual({ userId: 7, email: 'user@example.com', role: 'user' });
  });

  it('rejects a token issued before the last credential change', async () => {
    const strategy = buildStrategy(undefined, jest.fn().mockResolvedValue(4));

    await expect(
      strategy.validate(requestWith('access'), { ...payload, epoch: 3 }),
    ).resolves.toBeNull();
  });

  it('rejects a token that predates the epoch claim once the account rotated', async () => {
    const strategy = buildStrategy(undefined, jest.fn().mockResolvedValue(1));

    await expect(
      strategy.validate(requestWith('access'), payload),
    ).resolves.toBeNull();
  });

  it('accepts a legacy token for an account that never rotated', async () => {
    const strategy = buildStrategy();

    await expect(
      strategy.validate(requestWith('access'), payload),
    ).resolves.toEqual({ userId: 7, email: 'user@example.com', role: 'user' });
  });
});

describe('JwtStrategy credential type', () => {
  it('accepts an access token', async () => {
    const strategy = buildStrategy();
    await expect(
      strategy.validate(requestWith('access'), payload),
    ).resolves.toEqual({ userId: 7, email: 'user@example.com', role: 'user' });
  });

  it('rejects a refresh token used as a bearer credential', async () => {
    const strategy = buildStrategy();
    await expect(
      strategy.validate(requestWith('refresh'), { ...payload, typ: 'refresh' }),
    ).resolves.toBeNull();
  });

  it('rejects legacy untyped tokens on protected routes (CWE-613)', async () => {
    const strategy = buildStrategy();
    const { typ, ...untyped } = payload;
    void typ;
    await expect(
      strategy.validate(requestWith('untyped'), untyped),
    ).resolves.toBeNull();
  });

  it('rejects an access token revoked by logout via its hashed Redis key', async () => {
    const redisGet = jest
      .fn()
      .mockImplementation((key: string) =>
        Promise.resolve(
          key === blacklistKeyForToken('revoked') ? 'blacklisted' : null,
        ),
      );
    const strategy = buildStrategy(redisGet);
    await expect(
      strategy.validate(requestWith('revoked'), payload),
    ).resolves.toBeNull();
    expect(redisGet).toHaveBeenCalledWith(blacklistKeyForToken('revoked'));
  });

  it('enforces revocation for lowercase or multi-space Bearer headers (CWE-613)', async () => {
    const redisGet = jest
      .fn()
      .mockImplementation((key: string) =>
        Promise.resolve(
          key === blacklistKeyForToken('revoked-bearer') ? 'blacklisted' : null,
        ),
      );
    const strategy = buildStrategy(redisGet);
    const req = {
      cookies: {},
      headers: { authorization: 'bearer  revoked-bearer' },
    };
    await expect(strategy.validate(req, payload)).resolves.toBeNull();
    expect(redisGet).toHaveBeenCalledWith(
      blacklistKeyForToken('revoked-bearer'),
    );
  });
});
