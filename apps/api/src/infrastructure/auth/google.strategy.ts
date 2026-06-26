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
    // PUBLIC_API_URL is the externally-reachable base URL of this API server.
    // It is used as the Google OAuth callback URL — Google redirects the user's
    // browser here after authentication. Must be a URL that the end-user's device
    // can resolve (a public domain or IP, NOT localhost/0.0.0.0/127.0.0.1) because
    // the user's browser will try to reach it after the OAuth flow completes.
    //
    // Falls back to HOST for backward compatibility (though HOST is typically
    // localhost and should not be used in production).
    const isProduction = configService.get<string>('NODE_ENV') === 'production';

    const publicApiUrl =
      configService.get<string>('PUBLIC_API_URL') ||
      configService.get<string>('HOST') ||
      'http://localhost:3000';

    // Validate PUBLIC_API_URL in production. Without this guard, the Android
    // APK's Chrome Custom Tab is redirected by Google to an UNREACHABLE
    // origin (typically `http://localhost:5000` resolved on the user's
    // device, not the API server behind it) after the user picks their
    // account. The Custom Tab fails to load the page, so the bgg://custom
    // scheme redirect never fires — the OAuth round-trip cancels silently
    // and the auth slice never receives the JWT tokens. Symptom in
    // production: the Google account picker opens, then the user sees the
    // Custom Tab navigate to a URL containing "localhost:5000" and the
    // login never completes.
    //
    // Crash LOUDLY in production so the operator sees the misconfiguration
    // immediately during deploy instead of debugging a silent "Google
    // login works on web but not on APK" production bug. In dev we log a
    // warning so the local `pnpm dev` workflow isn't interrupted by
    // intentional localhost usage.
    if (isProduction) {
      if (!publicApiUrl || publicApiUrl.trim() === '') {
        throw new Error(
          '[GoogleStrategy] PUBLIC_API_URL is required in production. ' +
            "Set it in the .env (or your hosting provider's env config) to the externally-reachable base URL of this API " +
            '(e.g. https://api.budgetgeniusia.com). Without it, /api/auth/google-callback is registered with Google at an unreachable origin ' +
            'and OAuth logins from the Android APK cancel with "redirected to localhost:5000".',
        );
      }
      // Parse the URL and check ONLY the hostname against an exact-match
      // loopback set. This avoids substring false-positives on legitimate
      // hostnames like `mylocalhost.example.com` or `127.0.0.1.attacker.io`
      // which a naive `.includes('localhost')` regex would reject. The
      // `URL` parser also strips bracketing from IPv6 literals (`[::1]` →
      // `::1`) so the same `Set` lookup works for both v4 and v6.
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
      // Dev convenience — log once and continue so local `pnpm dev`
      // keeps working. Same URL-aware hostname check as the prod path,
      // but the log is non-fatal (we WANT localhost callbacks in dev).
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
