import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RedisService } from '@infrastructure/config/redis.service';

/** Reads the bearer credential from the same two channels Passport accepts. */
function extractAccessToken(req: any): string | null {
  const cookieToken = req?.cookies?.['accessToken'];
  if (typeof cookieToken === 'string' && cookieToken) return cookieToken;
  const header = req?.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim() || null;
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    super({
      // Usamos múltiples extractores en orden de prioridad
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Intentar extraer de la cookie 'accessToken'
        (req: any) => req?.cookies?.['accessToken'] ?? null,
        // 2. Intentar extraer del header Authorization: Bearer <token>
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    // Only access credentials authorize requests. Refresh tokens carry the
    // same identity and used to pass this check, turning a revoked refresh
    // token into a seven-day bearer credential.
    if (payload.typ !== 'access') {
      return null;
    }

    const token = extractAccessToken(req);
    if (token) {
      try {
        // Logout writes the access token into Redis with its remaining TTL;
        // honour that revocation instead of waiting for the JWT to expire.
        if (await this.redis.get(token)) return null;
      } catch {
        // Redis unavailable: keep authentication working, as the service's
        // development fallback does for the rest of the API.
      }
    }

    const userId = payload.id || payload.sub;
    if (!userId) {
      return null; // Passport rechazará la autenticación
    }
    return { userId, email: payload.email, role: payload.role };
  }
}
