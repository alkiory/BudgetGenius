import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { RedisService } from '@infrastructure/config/redis.service';
import { liveAnnouncementSql } from '@application/notifications/announcement-window';

/**
 * Cross-device change detection.
 *
 * Two clients of the same account (the APK and the SPA, or two browser tabs)
 * cannot share WebSocket state easily — the Capacitor WebView drops
 * cross-origin cookies, and the API may run behind more than one replica.
 * Instead the clients poll one cheap, authenticated endpoint that answers with
 * a revision string derived from the data they would otherwise have to
 * refetch. A changed revision means "some query is stale", so the client
 * invalidates its React Query cache and the UI updates without a manual
 * refresh.
 *
 * The revision folds in row counts as well as `MAX(updatedAt)` because a
 * delete changes neither timestamp of the remaining rows nor the max.
 *
 * Cost control: the whole per-user state is read in one statement (one scan
 * per table, not one subquery per column) and the answer is cached for a few
 * seconds, so several devices of the same account — or a burst of polls —
 * cost one query instead of N. The cache is shorter than the client's poll
 * interval, so a change is still noticed on the next tick.
 */
@Injectable()
export class SyncService {
  /** Shorter than the 15 s client poll: a change still lands on the next tick. */
  private static readonly CACHE_TTL_SECONDS = 5;

  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  async getRevision(
    userId: number,
  ): Promise<{ revision: string; serverTime: string }> {
    const cacheKey = `sync:revision:${userId}`;
    const cached = await this.readCache(cacheKey);
    if (cached) {
      return { revision: cached, serverTime: new Date().toISOString() };
    }

    const revision = await this.computeRevision(userId);
    await this.writeCache(cacheKey, revision);
    return { revision, serverTime: new Date().toISOString() };
  }

  private async computeRevision(userId: number): Promise<string> {
    const schema =
      (this.dataSource.options as { schema?: string }).schema || 'public';
    // `schema` comes from the TypeORM connection options (bg_public), never
    // from user input — the identifier cannot be parameterised.
    const table = (name: string) => `"${schema}"."${name}"`;

    const rows: Array<Record<string, string>> = await this.dataSource.query(
      `
      WITH ledger AS (
        SELECT COUNT(*)::text AS count, COALESCE(MAX("updatedAt")::text, '') AS updated
        FROM ${table('transactions')} WHERE "userId" = $1
      ),
      budgets AS (
        SELECT COUNT(*)::text AS count, COALESCE(MAX("updatedAt")::text, '') AS updated
        FROM ${table('budgets')} WHERE "userId" = $1
      ),
      budget_categories AS (
        SELECT COUNT(*)::text AS count, COALESCE(MAX(bc."updatedAt")::text, '') AS updated
        FROM ${table('budget_categories')} bc
        INNER JOIN ${table('budgets')} b ON b."id" = bc."budgetId"
        WHERE b."userId" = $1
      ),
      categories AS (
        SELECT COUNT(*)::text AS count, COALESCE(MAX("updatedAt")::text, '') AS updated
        FROM ${table('expense_categories')} WHERE "userId" = $1
      ),
      settings AS (
        SELECT COALESCE(MAX("updatedAt")::text, '') AS updated
        FROM ${table('user_settings')} WHERE "userId" = $1
      ),
      announcements AS (
        SELECT COUNT(*)::text AS count, COALESCE(MAX(n."updatedAt")::text, '') AS updated
        FROM ${table('app_notifications')} n
        WHERE ${liveAnnouncementSql('n')}
      )
      SELECT
        ledger.count AS "transactionsCount",
        ledger.updated AS "transactionsUpdated",
        budgets.count AS "budgetsCount",
        budgets.updated AS "budgetsUpdated",
        budget_categories.count AS "budgetCategoriesCount",
        budget_categories.updated AS "budgetCategoriesUpdated",
        categories.count AS "categoriesCount",
        categories.updated AS "categoriesUpdated",
        settings.updated AS "settingsUpdated",
        announcements.count AS "notificationsCount",
        announcements.updated AS "notificationsUpdated"
      FROM ledger, budgets, budget_categories, categories, settings, announcements
      `,
      [userId],
    );

    const row = rows[0] ?? {};
    return createHash('sha1')
      .update(
        Object.keys(row)
          .sort()
          .map((key) => row[key])
          .join('|'),
      )
      .digest('hex')
      .slice(0, 20);
  }

  /** Cache misses and Redis outages both fall back to the database. */
  private async readCache(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch {
      return null;
    }
  }

  private async writeCache(key: string, revision: string): Promise<void> {
    try {
      await this.redis.set(key, revision, SyncService.CACHE_TTL_SECONDS);
    } catch {
      // A cache that cannot be written must not break the endpoint.
    }
  }
}
