import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';

/**
 * A custom throttler guard that extends the default ThrottlerGuard to handle
 * requests coming from behind a proxy. It overrides the getTracker method to
 * use the first IP address from the `X-Forwarded-For` header if available,
 * otherwise it falls back to the direct IP address of the request.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.ips.length ? req.ips[0] : req.ip;
  }
}
