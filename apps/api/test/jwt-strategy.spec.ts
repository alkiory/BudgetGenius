/**
 * Access credentials are the only JWTs accepted by protected routes.
 *
 * The refresh token used to share the access token's claims, so a stolen
 * refresh credential worked as a seven-day bearer token; logout revocation
 * only covered the refresh endpoint. These tests pin the type check and the
 * Redis blacklist check.
 */

import { JwtStrategy } from '@infrastructure/config/strategy/jwt.strategy';

const buildStrategy = (redisGet = jest.fn().mockResolvedValue(null)) =>
  new JwtStrategy(
    { get: jest.fn().mockReturnValue('test-secret') } as any,
    { get: redisGet } as any,
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

  it('rejects tokens with no explicit type (pre-fix sessions)', async () => {
    const strategy = buildStrategy();
    const { typ, ...untyped } = payload;
    void typ;
    await expect(
      strategy.validate(requestWith('untyped'), untyped),
    ).resolves.toBeNull();
  });

  it('rejects an access token revoked by logout', async () => {
    const redisGet = jest.fn().mockResolvedValue('blacklisted');
    const strategy = buildStrategy(redisGet);
    await expect(
      strategy.validate(requestWith('revoked'), payload),
    ).resolves.toBeNull();
    expect(redisGet).toHaveBeenCalledWith('revoked');
  });
});
