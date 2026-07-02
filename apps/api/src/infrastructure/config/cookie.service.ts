import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
// v1.7.3 — replaced `src/app.module` (bare path, resolved via
// TypeScript's `baseUrl: "./"`) with the relative `../../app.module`.
// The bare-path form compiled under `tsc --noEmit` (because
// `tsconfig.json` declares `baseUrl: "./"` so `src/app.module`
// resolves to `apps/api/src/app.module` from `baseUrl`), but
// `jest.config.ts`'s `moduleNameMapper` only translates the project
// aliases (`@application/*`, `@adapters/*`, …) — bare paths like
// `src/...` are NOT mapped, so the v1.7.3 spec's `Test.createTestingModule`
// chain transitively fails to load `cookie.service.ts → src/app.module`.
// The relative form works under BOTH tsc AND jest. The runtime
// AppModule ↔ CookieService circularity remains — CookieService
// calls the static `AppModule.cookieOptions(configService)` to read
// shared cookie config — but it resolves cleanly because
// `AppModule.cookieOptions` is a pure static-method call resolved
// at JIT time, not a constructor-injected dependency.
import { AppModule } from '../../app.module';

@Injectable()
export class CookieService {
  constructor(private configService: ConfigService) {}

  setCookie(res: Response, name: string, value: string, options?: any) {
    const defaultOptions = AppModule.cookieOptions(this.configService);
    res.cookie(name, value, {
      ...defaultOptions,
      ...options,
    });
  }

  clearCookie(res: Response, name: string) {
    const defaultOptions = AppModule.cookieOptions(this.configService);
    res.clearCookie(name, {
      ...defaultOptions,
      sameSite: defaultOptions.sameSite as 'none' | 'lax' | 'strict',
    });
  }

  clearAllCookies(res: Response, cookieName: string) {
    const defaultOptions = AppModule.cookieOptions(this.configService);
    res.clearCookie(cookieName, {
      ...defaultOptions,
      sameSite: defaultOptions.sameSite as 'none' | 'lax' | 'strict',
    });
  }
}
