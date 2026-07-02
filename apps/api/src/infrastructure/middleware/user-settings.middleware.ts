import { Injectable, NestMiddleware } from '@nestjs/common';
import { UserSettingsService } from '@application/user/user-settings.service';

@Injectable()
export class UserSettingsMiddleware implements NestMiddleware {
  constructor(private settingsSvc: UserSettingsService) {}
  async use(req, res, next) {
    // v1.7.4 — same bug class as user.controller.ts#deleteUser (knowledge.md
    // §6.8.7). JwtStrategy.validate returns `{userId,email,role}` — never
    // `{id,email,role}` — so `req.user.id` is ALWAYS `undefined` at runtime.
    // The earlier code here did `if (req.user?.userId)` (correct check)
    // but then called `getOrCreateSettings(req.user.id)` (undefined!) — the
    // settings service silently created/loaded a settings row keyed to
    // `undefined` for every authenticated request. The conditional fires
    // only because the *read* used `userId` (truthy); the broken pass still
    // happened, but downstream code masked it because `getOrCreateSettings`
    // happened to tolerate undefined via its WHERE clause (no match → insert
    // a new orphan row keyed by `undefined`). Fixed: pass `req.user.userId`
    // through both sides of the gate.
    if (req.user?.userId) {
      req.user.settings = await this.settingsSvc.getOrCreateSettings(
        req.user.userId,
      );
    }
    next();
  }
}
