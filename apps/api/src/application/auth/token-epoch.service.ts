import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@infrastructure/config/redis.service';

/**
 * Per-user session epoch.
 *
 * An access token is a signed JWT, so nothing short of expiry normally ends
 * it. Changing (or resetting) a password must end it anyway: the whole point
 * of the change is to evict whoever else was holding the old credential.
 *
 * Every access token carries the epoch it was signed with, and `JwtStrategy`
 * compares it with this counter. `bump` ends every token issued before it,
 * including the one on the device that performed the change.
 *
 * The counter lives in Redis next to the refresh token, so both revocations
 * share one store and one outage mode: without Redis the app already cannot
 * rotate sessions.
 */
@Injectable()
export class TokenEpochService {
  private readonly logger = new Logger(TokenEpochService.name);

  constructor(private readonly redis: RedisService) {}

  private key(userId: number): string {
    return `tokenEpoch:${userId}`;
  }

  /** Current epoch. Accounts that never rotated a credential are at `0`. */
  async current(userId: number): Promise<number> {
    const raw = await this.redis.get(this.key(userId));
    const parsed = Number(raw ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  /** Ends every access token issued before this call. */
  async bump(userId: number): Promise<number> {
    const next = await this.redis.incr(this.key(userId));
    this.logger.log(`🔐 Session epoch for user id=${userId} is now ${next}`);
    return next;
  }
}
