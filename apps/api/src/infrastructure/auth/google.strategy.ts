import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '@application/auth/auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    const isProduction = configService.get<string>('NODE_ENV') === 'production';

    const publicApiUrl =
      configService.get<string>('PUBLIC_API_URL') || 'http://localhost:3000';

    if (isProduction) {
      if (!publicApiUrl || publicApiUrl.trim() === '') {
        throw new Error(
          '[GoogleStrategy] PUBLIC_API_URL is required in production. ' +
          "Set it in the .env (or your hosting provider's env config) to the externally-reachable base URL of this API " +
          '(e.g. https://api.budgetgeniusia.com). Without it, /api/auth/google-callback is registered with Google at an unreachable origin ' +
          'and OAuth logins from the Android APK cancel with "redirected to localhost:5000".',
        );
      }

      let parsed: URL;
      try {
        parsed = new URL(publicApiUrl);
      } catch {
        throw new Error(
          `[GoogleStrategy] PUBLIC_API_URL="${publicApiUrl}" is not a valid URL. ` +
          'It must include scheme + host (e.g. https://api.budgetgeniusia.com).',
        );
      }
      const loopbackHosts = new Set([
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        '::',
      ]);
      const normalisedHost = parsed.hostname
        .toLowerCase()
        .replace(/^\[|]$/g, '');
      if (loopbackHosts.has(normalisedHost)) {
        throw new Error(
          `[GoogleStrategy] PUBLIC_API_URL="${publicApiUrl}" points at a loopback host (${normalisedHost}). ` +
          'In production, this must be the actual public hostname of the API (e.g. https://api.budgetgeniusia.com). ' +
          'Chrome Custom Tabs in the Android WebView cannot reach loopback after Google completes the OAuth round-trip; ' +
          'the token exchange is silently cancelled.',
        );
      }
    } else if (publicApiUrl) {
      try {
        const parsed = new URL(publicApiUrl);
        const loopbackHosts = new Set([
          'localhost',
          '127.0.0.1',
          '0.0.0.0',
          '::1',
          '::',
        ]);
        const normalisedHost = parsed.hostname
          .toLowerCase()
          .replace(/^\[|]$/g, '');
        if (loopbackHosts.has(normalisedHost)) {
          // eslint-disable-next-line no-console
          console.warn(
            `[GoogleStrategy] PUBLIC_API_URL="${publicApiUrl}" is a loopback URL. Fine in dev, but the APK auth flow will not work with this URL.`,
          );
        }
      } catch {
        // Malformed PUBLIC_API_URL in dev → don't crash `pnpm dev`. The
        // prod-only crash above is the authoritative signal for that.
        console.warn(
          `[GoogleStrategy] PUBLIC_API_URL="${publicApiUrl}" is not a valid URL. ` +
          'It must include scheme + host (e.g. https://api.budgetgeniusia.com).',
        );
      }
    }

    const callbackURL = `${publicApiUrl}/api/auth/google-callback`;

    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL,
      scope: ['email', 'profile'],
      // Disable built-in CSRF state to avoid session requirement.
      // We don't use sessions in this app (JWT-only).
      state: false,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const user = await this.authService.validateOAuthUser({
        providerId: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
      });

      if (!user) {
        return done(new UnauthorizedException('User not found'), false);
      }

      done(null, user);
    } catch (error) {
      console.error('Error validating user:', error);
      done(error, false);
    }
  }
}
