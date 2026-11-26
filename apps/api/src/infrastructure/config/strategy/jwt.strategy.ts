import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { createHash } from 'crypto';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RedisService } from '@infrastructure/config/redis.service';

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
  ) {
    super({
      jwtFromRequest: accessTokenExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    // Reject refresh (or other non-access) tokens used as bearer credentials.
    // Legacy untyped tokens (`typ === undefined`) remain accepted during the
    // deployment cutover so existing sessions are not logged out mid-flight.
    if (payload?.typ !== undefined && payload.typ !== 'access') {
      return null;
    }

    const token = accessTokenExtractor(req);
    if (!token) {
      return null;
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
    } catch {
      // Redis unavailable: keep authentication working, as the service's
      // development fallback does for the rest of the API.
    }

    const userId = payload.id || payload.sub;
    if (!userId) {
      return null; // Passport rechazará la autenticación
    }
    return { userId, email: payload.email, role: payload.role };
  }
}
