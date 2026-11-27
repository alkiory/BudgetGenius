import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { createHash } from 'crypto';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RedisService } from '@infrastructure/config/redis.service';
import { TokenEpochService } from '@application/auth/token-epoch.service';

export const cookieAccessTokenExtractor = (req: any): string | null =>
  req?.cookies?.['accessToken'] ?? null;

export const bearerAccessTokenExtractor =
  ExtractJwt.fromAuthHeaderAsBearerToken();

/**
 * Single extractor instance shared by Passport, `validate()`, and `logout()`
 * so header parsing (e.g. case-insensitive `bearer`, extra whitespace) never
 * diverges between authentication and revocation lookup.
 */
export const accessTokenExtractor = ExtractJwt.fromExtractors([
  cookieAccessTokenExtractor,
  bearerAccessTokenExtractor,
]);

/** Namespaced SHA-256 key so raw JWTs are never stored or logged as Redis keys. */
export function blacklistKeyForToken(token: string): string {
  const digest = createHash('sha256').update(token).digest('hex');
  return `blacklist:access:${digest}`;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly redis: RedisService,
    private readonly tokenEpoch: TokenEpochService,
  ) {
    super({
      jwtFromRequest: accessTokenExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    // Require an explicit access token type on protected routes so legacy
    // untyped refresh tokens cannot bypass refresh-session revocation.
    if (payload?.typ !== 'access') {
      return null;
    }

    const token = accessTokenExtractor(req);
    if (!token) {
      return null;
    }

    const userId = payload.id || payload.sub;
    if (!userId) {
      return null; // Passport rechazará la autenticación
    }

    try {
      // Logout writes the hashed access token into Redis with its remaining
      // TTL; also check the legacy raw key during cutover.
      if (
        (await this.redis.get(blacklistKeyForToken(token))) ||
        (await this.redis.get(token))
      ) {
        return null;
      }

      // A credential change bumps the account's epoch. A token signed before
      // it — including the one on the device that made the change — is dead
      // even though its signature and expiry are still valid. Tokens issued
      // before this claim existed count as epoch 0.
      const currentEpoch = await this.tokenEpoch.current(Number(userId));
      if (Number(payload.epoch ?? 0) !== currentEpoch) {
        return null;
      }
    } catch {
      // Redis unavailable: keep authentication working, as the service's
      // development fallback does for the rest of the API.
    }

    return { userId, email: payload.email, role: payload.role };
  }
}
