import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '@application/auth/auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    // PUBLIC_API_URL is the externally-reachable base URL of this API server.
    // It is used as the Google OAuth callback URL — Google redirects the user's
    // browser here after authentication. Must be a URL that the end-user's device
    // can resolve (a public domain or IP, NOT localhost/0.0.0.0) because the
    // browser will try to reach it after the OAuth flow completes.
    //
    // Falls back to HOST for backward compatibility (though HOST is typically
    // localhost and should not be used in production).
    const publicApiUrl =
      configService.get<string>('PUBLIC_API_URL') ||
      configService.get<string>('HOST') ||
      'http://localhost:3000';

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
