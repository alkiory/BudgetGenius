import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      // Usamos múltiples extractores en orden de prioridad
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Intentar extraer de la cookie 'accessToken'
        (req: any) => {
          let token = null;
          if (req && req.cookies) {
            token = req.cookies['accessToken'];
          }
          return token;
        },
        // 2. Intentar extraer del header Authorization: Bearer <token>
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // El JWT se firma con { id, email, role } (login, oauthLogin) o { sub } (refreshToken)
    const userId = payload.id || payload.sub;
    if (!userId) {
      return null; // Passport rechazará la autenticación
    }
    return { userId, email: payload.email, role: payload.role };
  }
}
