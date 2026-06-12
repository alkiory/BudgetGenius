import { Injectable, NestMiddleware } from '@nestjs/common';
import { UserSettingsService } from '@application/user/user-settings.service';

@Injectable()
export class UserSettingsMiddleware implements NestMiddleware {
  constructor(private settingsSvc: UserSettingsService) {}
  async use(req, res, next) {
    if (req.user?.userId) {
      req.user.settings = await this.settingsSvc.getOrCreateSettings(
        req.user.id,
      );
    }
    next();
  }
}
