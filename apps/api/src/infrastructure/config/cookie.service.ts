import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AppModule } from 'src/app.module';

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
