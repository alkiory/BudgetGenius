import { SelectQueryBuilder } from 'typeorm';
import { AppNotification } from '@domain/superadmin/app-notification.entity';

/**
 * The one definition of "live".
 *
 * An announcement is live when it is published, its window has opened and it
 * has not expired. The user feed, the backoffice counter and the sync
 * revision all read this predicate, so the number the operator sees can never
 * disagree with what the app shows.
 *
 * `publishedAt` doubles as the schedule (a future timestamp publishes later
 * without a cron), and `expiresAt` retires the row by itself.
 */
export const liveAnnouncementSql = (alias = 'n'): string => `
  ${alias}."published" = true
  AND (${alias}."publishedAt" IS NULL OR ${alias}."publishedAt" <= now())
  AND (${alias}."expiresAt" IS NULL OR ${alias}."expiresAt" > now())
`;

/** QueryBuilder form of {@link liveAnnouncementSql} for the same predicate. */
export const applyLiveAnnouncementFilter = (
  query: SelectQueryBuilder<AppNotification>,
  alias = 'n',
): SelectQueryBuilder<AppNotification> =>
  query
    .where(`${alias}."published" = true`)
    .andWhere(
      `(${alias}."publishedAt" IS NULL OR ${alias}."publishedAt" <= now())`,
    )
    .andWhere(`(${alias}."expiresAt" IS NULL OR ${alias}."expiresAt" > now())`);
