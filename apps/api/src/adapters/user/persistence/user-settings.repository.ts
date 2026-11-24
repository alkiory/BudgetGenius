import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from '@domain/user/user-settings.entity';

@Injectable()
export class UserSettingsRepository {
  constructor(
    @InjectRepository(UserSettings)
    private repo: Repository<UserSettings>,
  ) {}

  findByUserId(userId: number) {
    return this.repo.findOne({ where: { user: { id: userId } } });
  }

  create(settings: Partial<UserSettings>) {
    return this.repo.create(settings);
  }

  save(settings: UserSettings) {
    return this.repo.save(settings);
  }

  /**
   * D1: rows that would be silently re-labelled (not converted) if the
   * profile currency changed. A transaction, a budget or an expense
   * category stores a bare amount, so `PATCH /user-settings { currency }`
   * after money exists reinterprets every historical number. One round-trip
   * with three sub-selects because this runs on every PATCH that carries a
   * currency; a currency-agnostic row (`expense_categories.value = 0`) does
   * not lock the account.
   *
   * Tables are schema-qualified on purpose: `manager.query` bypasses
   * TypeORM's `schema: 'bg_public'` qualification.
   */
  async countFinancialHistory(userId: number): Promise<number> {
    const rows: Array<{ count: number }> = await this.repo.manager.query(
      `SELECT (
         (SELECT count(*) FROM "bg_public"."transactions"
           WHERE "userId" = $1)
         + (SELECT count(*) FROM "bg_public"."budgets"
             WHERE "userId" = $1)
         + (SELECT count(*) FROM "bg_public"."expense_categories"
             WHERE "userId" = $1 AND "value" <> 0)
       )::int AS count`,
      [userId],
    );
    return Number(rows?.[0]?.count ?? 0);
  }
}
