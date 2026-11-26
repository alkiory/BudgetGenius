import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';

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
 */
@Injectable()
export class SyncService {
  constructor(private readonly dataSource: DataSource) {}

  async getRevision(
    userId: number,
  ): Promise<{ revision: string; serverTime: string }> {
    const schema =
      (this.dataSource.options as { schema?: string }).schema || 'public';
    // `schema` comes from the TypeORM connection options (bg_public), never
    // from user input — the identifier cannot be parameterised.
    const table = (name: string) => `"${schema}"."${name}"`;

    const rows: Array<Record<string, string>> = await this.dataSource.query(
      `
      SELECT
        (SELECT COUNT(*) FROM ${table('transactions')} WHERE "userId" = $1)::text AS "transactionsCount",
        (SELECT COALESCE(MAX("updatedAt")::text, '') FROM ${table('transactions')} WHERE "userId" = $1) AS "transactionsUpdated",
        (SELECT COUNT(*) FROM ${table('budgets')} WHERE "userId" = $1)::text AS "budgetsCount",
        (SELECT COALESCE(MAX("updatedAt")::text, '') FROM ${table('budgets')} WHERE "userId" = $1) AS "budgetsUpdated",
        (SELECT COUNT(*) FROM ${table('budget_categories')} bc
           INNER JOIN ${table('budgets')} b ON b."id" = bc."budgetId"
          WHERE b."userId" = $1)::text AS "budgetCategoriesCount",
        (SELECT COALESCE(MAX(bc."updatedAt")::text, '') FROM ${table('budget_categories')} bc
           INNER JOIN ${table('budgets')} b ON b."id" = bc."budgetId"
          WHERE b."userId" = $1) AS "budgetCategoriesUpdated",
        (SELECT COUNT(*) FROM ${table('expense_categories')} WHERE "userId" = $1)::text AS "categoriesCount",
        (SELECT COALESCE(MAX("updatedAt")::text, '') FROM ${table('expense_categories')} WHERE "userId" = $1) AS "categoriesUpdated",
        (SELECT COALESCE(MAX("updatedAt")::text, '') FROM ${table('user_settings')} WHERE "userId" = $1) AS "settingsUpdated",
        (SELECT COUNT(*) FROM ${table('app_notifications')} WHERE "published" = true)::text AS "notificationsCount",
        (SELECT COALESCE(MAX("updatedAt")::text, '') FROM ${table('app_notifications')}) AS "notificationsUpdated"
      `,
      [userId],
    );

    const row = rows[0] ?? {};
    const revision = createHash('sha1')
      .update(Object.keys(row).sort().map((key) => row[key]).join('|'))
      .digest('hex')
      .slice(0, 20);

    return { revision, serverTime: new Date().toISOString() };
  }
}
