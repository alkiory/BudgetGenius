import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * One line per HTTP request: method, path, status and duration.
 *
 * The API only logged application events, so during a hung page there was no
 * way to tell whether a request the browser showed as `pending` had reached
 * the backend at all. Each request now logs twice, under the same short id:
 *
 *   - `→` on arrival, so a request that hangs is visible while it hangs;
 *   - `←` when it finishes, with the status and the duration;
 *   - `499 (client closed)` when the connection drops before an answer, which
 *     is what a stall looks like from the server side.
 *
 * A request the browser shows as pending and that never logs `→` was stopped
 * in front of us (tunnel, nginx, the browser).
 *
 * It is registered on the Express instance before the Nest router (see
 * main.ts), so it also covers requests rejected by the throttler, the guards
 * and the body parser, none of which reach an interceptor.
 */
const logger = new Logger('HTTP');

/** Static assets would bury the API calls on every page load. */
const ASSET_PATH = /\.(?:js|css|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf)$/i;

export function accessLogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // The query string can carry tokens or addresses; the path alone identifies
  // the endpoint and keeps credentials out of `docker logs`.
  const path = (req.originalUrl ?? req.url ?? '').split('?')[0];

  if (ASSET_PATH.test(path)) {
    next();
    return;
  }

  const id = randomUUID().slice(0, 8);
  const startedAt = process.hrtime.bigint();
  let written = false;

  logger.log(`→ ${id} ${req.method} ${path}`);

  const write = (status: number, note = ''): void => {
    if (written) {
      return;
    }
    written = true;
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.log(
      `← ${id} ${req.method} ${path} ${status} ${ms.toFixed(1)}ms${note}`,
    );
  };

  res.on('finish', () => write(res.statusCode));
  // A client that gives up (tab closed, proxy timeout) never emits `finish`.
  // 499 is the nginx convention for "client closed request".
  res.on('close', () => {
    if (!res.writableEnded) {
      write(499, ' (client closed)');
    }
  });

  next();
}
