import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Budget } from '@domain/dashboard/budget.entity';
import { ExpenseCategory } from '@domain/dashboard/expense-category.entity';
import { Transaction } from '@domain/dashboard/transaction.entity';
import { User } from '@domain/user/user.entity';
import { AppApiKey } from '@domain/superadmin/app-api-key.entity';
import { AppModule } from '@domain/superadmin/app-module.entity';
import { AppNotification } from '@domain/superadmin/app-notification.entity';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SuperAdminOverview {
  users: { total: number; last7d: number; last30d: number };
  transactions: {
    total: number;
    last24h: number;
    last7d: number;
    last30d: number;
  };
  data: { budgets: number; categories: number };
  modules: {
    total: number;
    active: number;
    disabled: number;
    byKind: { module: number; component: number; integration: number };
  };
  apiKeys: { total: number; active: number };
  notifications: { total: number; live: number };
  activity: Array<{ month: string; transactions: number; amount: number }>;
}

/**
 * Read-only usage snapshot for the super admin.
 *
 * Deliberately aggregate-only: the backoffice scales the product, it does not
 * browse people. No endpoint here returns a user row, an email or a per-user
 * series.
 */
@Injectable()
export class SuperAdminOverviewService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    @InjectRepository(Budget) private readonly budgets: Repository<Budget>,
    @InjectRepository(ExpenseCategory)
    private readonly categories: Repository<ExpenseCategory>,
    @InjectRepository(AppModule) private readonly modules: Repository<AppModule>,
    @InjectRepository(AppApiKey)
    private readonly apiKeys: Repository<AppApiKey>,
    @InjectRepository(AppNotification)
    private readonly notifications: Repository<AppNotification>,
  ) {}

  async getOverview(): Promise<SuperAdminOverview> {
    const now = Date.now();
    const since = (days: number) => new Date(now - days * DAY_MS);

    const [
      usersTotal,
      users7d,
      users30d,
      transactionsTotal,
      transactions24h,
      transactions7d,
      transactions30d,
      budgetsTotal,
      categoriesTotal,
      modules,
      apiKeys,
      notificationsTotal,
      notificationsLive,
      activity,
    ] = await Promise.all([
      this.users.count(),
      this.users.count({ where: { createdAt: MoreThanOrEqual(since(7)) } }),
      this.users.count({ where: { createdAt: MoreThanOrEqual(since(30)) } }),
      this.transactions.count(),
      this.transactions.count({
        where: { createdAt: MoreThanOrEqual(since(1)) },
      }),
      this.transactions.count({
        where: { createdAt: MoreThanOrEqual(since(7)) },
      }),
      this.transactions.count({
        where: { createdAt: MoreThanOrEqual(since(30)) },
      }),
      this.budgets.count(),
      this.categories.count(),
      this.modules.find(),
      this.apiKeys.find(),
      this.notifications.count(),
      this.notifications.count({ where: { published: true } }),
      this.transactions
        .createQueryBuilder('t')
        .select(`to_char(date_trunc('month', t.date), 'YYYY-MM')`, 'month')
        .addSelect('COUNT(*)::int', 'transactions')
        .addSelect('COALESCE(SUM(t.amount), 0)::float', 'amount')
        .where('t.date >= :since', { since: since(30 * 6) })
        .groupBy('1')
        .orderBy('1', 'ASC')
        .getRawMany<{ month: string; transactions: number; amount: number }>(),
    ]);

    const activeModules = modules.filter((m) => m.status !== 'disabled');
    const byKind = { module: 0, component: 0, integration: 0 };
    for (const item of activeModules) {
      if (item.kind in byKind) byKind[item.kind] += 1;
    }

    return {
      users: { total: usersTotal, last7d: users7d, last30d: users30d },
      transactions: {
        total: transactionsTotal,
        last24h: transactions24h,
        last7d: transactions7d,
        last30d: transactions30d,
      },
      data: { budgets: budgetsTotal, categories: categoriesTotal },
      modules: {
        total: modules.length,
        active: activeModules.length,
        disabled: modules.length - activeModules.length,
        byKind,
      },
      apiKeys: {
        total: apiKeys.length,
        active: apiKeys.filter((key) => !key.revokedAt).length,
      },
      notifications: {
        total: notificationsTotal,
        live: notificationsLive,
      },
      activity,
    };
  }
}
