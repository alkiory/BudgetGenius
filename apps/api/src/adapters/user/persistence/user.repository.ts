import { Injectable, NotFoundException } from '@nestjs/common';
import { UserDto } from '@application/user/dto/user.dto';
import { Budget } from '@domain/dashboard/budget.entity';
import { ExpenseCategory } from '@domain/dashboard/expense-category.entity';
import { Overview } from '@domain/dashboard/overview.entity';
import { Transaction } from '@domain/dashboard/transaction.entity';
import { User } from '@domain/user/user.entity';
import { UserSettings } from '@domain/user/user-settings.entity';
import { UserRepositoryPort } from '@domain/user/user.repository.port';
import { LoggingService } from '@infrastructure/log/logger.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UserRepositoryImpl implements UserRepositoryPort {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    private readonly logger: LoggingService,
  ) {}
  async createUser({
    name,
    surname,
    email,
    password,
    role,
    authProvider,
  }: Omit<UserDto, 'id' | 'isPremium'>): Promise<User> {
    const user = new User();

    user.name = name;
    user.surname = surname;
    user.email = email;
    user.password = password;
    user.role = role;
    user.authProvider = authProvider;
    // isPremium now defaults at the DB column level (see migration IspremiumDefaultTrue).

    return this.save(user);
  }

  async save(user: UserDto): Promise<User> {
    const savedUser = await this.repo.save(user);
    return savedUser;
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.repo.findOne({ where: { email } });
      return user;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  async findById(id: number): Promise<User | null> {
    try {
      const user = await this.repo.findOne({
        where: { id },
        // Phase 6.8 (Bug B): the `incomes` relation was removed in
        // Phase 4 (T4.1-T4.6). Eagerly loading it on `findById` throws
        // `EntityPropertyNotFoundError: Property "incomes" was not
        // found in "User"` whenever incomePage (or any page that calls
        // /api/auth/verify → loadUser → findById) mounts.
        relations: ['budgets', 'transactions'],
      });
      return user;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  async getAll(): Promise<User[]> {
    const users = await this.repo.find();
    return users;
  }

  async updateToken(id: number, refreshToken: string): Promise<void> {
    await this.repo.update(id, { refreshToken });
  }

  async updateUser(id: number, updateUserDto: Partial<UserDto>): Promise<User> {
    // `repo.preload({ id, ...partial })` reads the row, builds a User
    // entity instance with the partial MERGED on top of the loaded
    // values (so `password` overwrites the existing hash in memory
    // BEFORE hooks fire), and returns the hydrated entity. The
    // subsequent `repo.save(preloaded)` then fires the User entity's
    // `@BeforeUpdate hashPassword` hook which bcrypt-hashes the new
    // plaintext — see `User.hashPassword` in
    // `apps/api/src/domain/user/user.entity.ts`.
    //
    // This is the TypeORM-idiomatic pattern for an UPDATE-with-hooks.
    // The previous `repo.update(id, partial)` ran a bare UPDATE
    // statement that BYPASSed hooks; service-layer callers compensated
    // by manually pre-hashing, which is the exact footgun that caused
    // the /profile password update 401-on-login bug. The hook is now
    // the single source of truth for password hashing — callers
    // forward plaintext and trust the entity.
    const preloaded = await this.repo.preload({ id, ...updateUserDto });
    if (!preloaded) {
      throw new NotFoundException(`⚠️ User with id ${id} not found`);
    }
    return this.repo.save(preloaded);
  }

  async deleteUserTransactional(id: number): Promise<void> {
    // v1.7.2 — children-first cascade. The previous `repo.delete({id})`
    // tripped the FK constraints declared in
    // `apps/api/src/migrations/1776510954066-InitialMigration.ts`
    // (`ON DELETE NO ACTION` from each child table → `users`) AND
    // — if it somehow succeeded silently — left orphan rows in
    // `user_settings`, `transactions`, `budgets`, `expense_categories`,
    // `overview`. The downstream symptom was a `hasCompletedOnboarding:
    // true` orphan that survived a re-signup as the same email and
    // bypassed the OnboardingGuard (knowledge.md §6.8.3 + §6.8.5).
    //
    // The initial migration declared EIGHT child tables of `users`:
    //   `budgets`, `transactions`, `expense_categories`, `overview`,
    //   `user_settings`, `saving_goals`, `incomes`, `goals`.
    // Three of those (saving_goals, incomes, goals) DO NOT have
    // TypeORM entity files in `apps/api/src/domain/` today, because
    // later migrations either merged them into another table or
    // dropped the table entirely:
    //   - `incomes`      → merged into `transactions` (see migration
    //                      `1776520999999-MergeIncomeIntoTransaction`).
    //                      Pre-merge DBs may still have orphan rows.
    //   - `goals`        → dropped entirely (see migration
    //                      `1800000000000-RemoveGoalsTable`). Stale
    //                      snapshots of the table may retain rows
    //                      pointing to a user being deleted.
    //   - `saving_goals` → no entity, no merge, no drop in the
    //                      migration history we have on disk. Likely
    //                      exists on production DBs that predate
    //                      the v1.7 cleanup; cascade must still
    //                      remove rows pointing to the user.
    //
    // Because the entity files do not exist for these three tables,
    // `tx.delete(EntityClass, criteria)` cannot be used. The
    // canonical pattern (chosen in `rpi/delete-account-cleanup/plan.md`
    // §T1.1 trade-off matrix, option 4) is a guarded raw-SQL
    // pre-check against `information_schema.tables`, then a
    // conditional `DELETE FROM bg_public.<table>`. Pre-check costs
    // ≈2 ms per legacy table on the deletion path; this is acceptable
    // because (a) account deletion is a once-per-account event, not
    // a hot path, and (b) the alternative — creating stub TypeORM
    // entities purely for the delete path — pollutes `domain/` with
    // ghost classes that services should not use.
    //
    // Children's FK column names are confirmed:
    //   - budgets.userId, transactions.userId, expense_categories.userId,
    //     overview.userId     @JoinColumn({ name: 'userId' }) on
    //                            Transaction / Budget / Overview; default
    //                            for ManyToOne elsewhere.
    //   - user_settings.userId                  default ManyToOne name.
    //   - saving_goals.userId, incomes.userId, goals.userId
    //                            raw SQL pre-check + DELETE.
    //
    // Order matters: parents AFTER children, otherwise the FK
    // constraint fires a `QueryFailedError`. We use the TypeORM
    // entity-based delete so the connection-wide `schema: 'bg_public'`
    // config (apps/api/src/data-source.ts:32) is honoured transparent
    // and the criteria column is mapped automatically.
    //
    // Budget's category children (BudgetCategory) are NOT deleted
    // here because the FK on budget_categories.budgetId is
    // `ON DELETE CASCADE` (per the initial migration). The DB layer
    // takes care of that for free.
    //
    // Migration-free constraint: a future RPI may add FK-level
    // `ON DELETE CASCADE` and convert this method to `await
    // this.repo.delete({ id });` (a one-line rollback). Until then,
    // the manual cascade is the only path that succeeds at runtime.
    // The §6.8.5 lint hook (TODO — see the bottom of the section)
    // will flag a future contributor who either (a) forgets the
    // `manager.transaction` wrapper, or (b) registers a new
    // `User`-owning entity that is not added to this cascade list.
    await this.repo.manager.transaction(async (tx) => {
      // v1.7.2 — rationale: pre-check existence so a freshly-migrated
      // DB where the table was DROPPED doesn't throw `relation does
      // not exist`. The raw SQL bypasses TypeORM entity metadata
      // because these tables have no `apps/api/src/domain/**/*.entity.ts`
      // registration today (their entity files were either never
      // written or were dropped when the entity was merged elsewhere).
      // SECURITY: callers MUST pass hardcoded table-name literals —
      // the helper interpolates `${tableName}` into a DELETE
      // statement and would be an SQL-injection vector for
      // user-supplied input. The three current callers (`'incomes'`,
      // `'goals'`, `'saving_goals'`) are all compile-time constants.
      const deleteLegacyTableIfExists = async (tableName: string) => {
        const [{ exists }] = await tx.query(
          `SELECT EXISTS (
             SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'bg_public' AND table_name = $1
           )`,
          [tableName],
        );
        // v1.7.3+ — STRICT-EQUALITY existence check, NOT loose `if (exists)`.
        // Postgres `EXISTS` aggregates return JS booleans via the default
        // `pg` driver (`true` / `false`) but `'t'` / `'f'` strings via some
        // `pg-native` / `pg-query-stream` configurations. The previous
        // loose `if (exists) { … }` shape silently mis-handled the
        // `'f'` case on the latter (non-empty strings are truthy in
        // JavaScript) — `if ('f')` evaluates truthy, so we'd query a
        // non-existent table and throw `relation does not exist`. The
        // strict `=== true || === 't'` shape aligns production AND
        // test (`apps/api/test/user-delete-permission.spec.ts`
        // `assertChildCountIsZero` helper) on the exact same
        // Postgres return-shape contract.
        if (exists === true || exists === 't') {
          // v1.7.2 — schema-qualified table name; raw SQL bypasses
          // TypeORM entity metadata. `"userId"` is double-quoted
          // because the column was created with camelCase by the
          // initial migration and Postgres folds unquoted identifiers.
          await tx.query(
            `DELETE FROM "bg_public"."${tableName}" WHERE "userId" = $1`,
            [id],
          );
        }
      };

      // v1.7.2 — rationale: stale-merge / un-migrated DBs may still
      // have `incomes` rows pointing to the user. Merging into
      // `transactions` only ran on the migration apply — interrupted
      // or never-applied databases still have active `incomes` rows.
      await deleteLegacyTableIfExists('incomes');

      // v1.7.2 — rationale: `goals` was officially DROPPED by
      // migration `1800000000000-RemoveGoalsTable` but a stale DB
      // snapshot or a recovery from a backup frozen before that
      // migration may still have rows. Pre-check guards against
      // `relation does not exist`.
      await deleteLegacyTableIfExists('goals');

      // v1.7.2 — rationale: `saving_goals` has no entity file AND
      // no merge/drop migration on disk, so the safe assumption is
      // "exists in production DBs, just no domain class".
      await deleteLegacyTableIfExists('saving_goals');

      // v1.7.2 — cascade modern child entities. TypeORM honors
      // `bg_public` schema config automatically. Order between peer
      // child tables doesn't strict-matter, but they MUST precede
      // the User parent.
      await tx.delete(UserSettings, { userId: id });
      await tx.delete(Transaction, { userId: id });
      await tx.delete(Budget, { userId: id });
      await tx.delete(ExpenseCategory, { userId: id });
      await tx.delete(Overview, { userId: id });

      // v1.7.2 — LAST: the user row. If any child delete fails (e.g.
      // an orphaned-and-broken FK the migration didn't anticipate),
      // TypeORM rolls the transaction back leaving the user row
      // intact — a recoverable state, NOT a partial delete.
      await tx.delete(User, { id });
    });
  }

  /**
   * Public delete entry point. Kept on the port surface for backwards
   * compatibility with the existing
   * `apps/api/src/application/user/user.service.ts#deleteUser` and
   * `apps/api/test/user-service.spec.ts` callers; delegates to the
   * transactional variant so callers do not need to know about the
   * cascade change.
   */
  async deleteUser(id: number): Promise<void> {
    await this.deleteUserTransactional(id);
  }
}
