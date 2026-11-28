import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * One line per HTTP request: method, path, status and duration.
 *
 * The API only logged application events, so during a hung page there was no
 * way to tell whether a request the browser showed as `pending` had reached
 * the backend at all. With this line:
 *
 *   - a request that never appears here was stopped in front of us (tunnel,
 *     nginx, the browser);
 *   - a request that appears and never ends shows up as `499 (client closed)`
 *     when the connection drops, so a stall is visible while it is happening.
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

  const startedAt = process.hrtime.bigint();
  let written = false;

  const write = (status: number, note = ''): void => {
    if (written) {
      return;
    }
    written = true;
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.log(`${req.method} ${path} ${status} ${ms.toFixed(1)}ms${note}`);
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
