import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserDto } from '@application/user/dto/user.dto';
import { Budget } from '@domain/dashboard/budget.entity';
import { ExpenseCategory } from '@domain/dashboard/expense-category.entity';
import { Overview } from '@domain/dashboard/overview.entity';
import { Transaction } from '@domain/dashboard/transaction.entity';
import { User, BCRYPT_COST, normalizeEmail } from '@domain/user/user.entity';
import { UserSettings } from '@domain/user/user-settings.entity';
import { UserRepositoryPort } from '@domain/user/user.repository.port';
import { LoggingService } from '@infrastructure/log/logger.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

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
    user.email = normalizeEmail(email);
    user.password = password;
    user.role = role;
    user.authProvider = authProvider;
    // isPremium now defaults at the DB column level (see migration IspremiumDefaultTrue).

    return this.save(user);
  }

  async save(user: UserDto): Promise<User> {
    // Single write choke point for every path that persists a user (signup,
    // OAuth, profile update, seed): stored addresses are always canonical, so
    // the UNIQUE index on LOWER(email) and lookups cannot disagree.
    if (typeof user.email === 'string') {
      user.email = normalizeEmail(user.email);
    }
    const savedUser = await this.repo.save(user);
    return savedUser;
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      // `email` is NOT UNIQUE at column level, only `LOWER(email)` is indexed;
      // comparing the canonical form is what makes `Foo@x.com` find `foo@x.com`.
      const user = await this.repo.findOne({
        where: { email: normalizeEmail(email) },
      });
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

  async updateToken(id: number, refreshToken: string): Promise<void> {
    await this.repo.update(id, { refreshToken });
  }

  /**
   * Removes the local password of an account.
   *
   * Used when a provider proves the mailbox of the operator account: a
   * password registered before the address belonged to its owner is a second
   * credential, and it must not survive the promotion. The column is nullable;
   * the entity types it as `string` because every hydrated row with a password
   * has one, so the cast writes SQL NULL through the targeted update.
   */
  async clearPassword(id: number): Promise<void> {
    await this.repo.update(id, { password: null as unknown as string });
  }

  /**
   * Role-only update. Deliberately uses `repo.update` instead of
   * `preload` + `save`: the entity's `@BeforeUpdate hashPassword` hook would
   * re-hash the already-hashed column and lock the account out. No password
   * is touched here, so skipping the hooks is the correct behaviour.
   */
  async setRole(id: number, role: string): Promise<void> {
    await this.repo.update(id, { role });
  }

  /**
   * Demotes every superadmin except `keepUserId`, returning how many rows
   * changed.
   *
   * `SUPERADMIN_EMAIL` names the one operator, so a second row with the role
   * is always a leftover — an old address, a manual UPDATE, or the signup
   * role hole — and it would keep full backoffice access. `update()` bypasses
   * the entity hooks on purpose (see `setRole`).
   */
  /**
   * Demotes every superadmin except `keepUserId` and returns the ids it
   * demoted.
   *
   * The ids matter: a demoted operator's refresh token still lives in Redis,
   * and `/auth/refresh` would keep renewing it. A bare count would leave the
   * caller unable to revoke those sessions.
   */
  async demoteSuperAdminsExcept(keepUserId: number): Promise<number[]> {
    const result = await this.repo
      .createQueryBuilder()
      .update(User)
      .set({ role: 'user' })
      .where('role = :role', { role: 'superadmin' })
      .andWhere('id != :id', { id: keepUserId })
      .returning(['id'])
      .execute();

    return ((result.raw ?? []) as Array<{ id: number }>).map((row) => row.id);
  }

  /** Reads only the role, for flows that must not trust a token claim. */
  async findRoleById(id: number): Promise<{ id: number; role: string } | null> {
    return this.repo.findOne({ where: { id }, select: ['id', 'role'] });
  }

  /**
   * Targeted UPDATE: only the columns present in the patch are written.
   *
   * `repo.preload` + `repo.save` used to read the row, merge the partial and
   * write EVERY column back. That read-modify-write could resurrect a stale
   * `role` — a profile save racing the operator handover would undo the
   * demotion — and it rewrote fields nobody asked to change.
   *
   * Hashing lives here because `repo.update` bypasses the entity hooks; the
   * `@BeforeUpdate` hook still covers callers that go through `repo.save`.
   */
  async updateUser(id: number, updateUserDto: Partial<UserDto>): Promise<User> {
    const { password, ...rest } = updateUserDto;
    const patch: QueryDeepPartialEntity<User> = { ...rest };
    if (password) {
      patch.password = await bcrypt.hash(password, BCRYPT_COST);
    }

    if (Object.keys(patch).length > 0) {
      const result = await this.repo.update(id, patch);
      if (!result.affected) {
        throw new NotFoundException(`⚠️ User with id ${id} not found`);
      }
    }

    const updated = await this.repo.findOne({ where: { id } });
    if (!updated) {
      throw new NotFoundException(`⚠️ User with id ${id} not found`);
    }
    return updated;
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
      //
      // v1.7.4.1 — SECOND-ROOT-CAUSE fix for the APK profile-delete
      // 500-error regression. The previous criteria shape was
      // `{ userId: id }` (literal column-name criteria), which seems
      // intuitive because the SQL `WHERE "userId" = $1` is exactly
      // what gets emitted. BUT — and this is the load-bearing part —
      // TypeORM's `tx.delete(Entity, criteria)` validates the
      // criteria KEYS against the entity's PROPERTY NAMES, not its
      // column names. None of the child entities declares a literal
      // `userId: number` property:
      //   - `UserSettings`    has `@ManyToOne(() => User) user: User` (no `@Column` for userId).
      //   - `Transaction`     has `@ManyToOne + @JoinColumn({name:'userId'}) user: User` (no `@Column`).
      //   - `Budget`          same pattern.
      //   - `ExpenseCategory` same pattern.
      //   - `Overview`        same pattern.
      // The runtime error from the first attempted delete was:
      //   EntityPropertyNotFoundError: Property "userId" was not found
      //   in "UserSettings". Make sure your query is correct.
      // thrown on the very FIRST iteration (UserSettings) → the
      // entire transaction rolls back → NO child row is removed →
      // 500 surface to the /user/:id DELETE controller. The user-
      // delete-permission regression spec passed pre-v1.7.4
      // ONLY because the v1.7.3 string-vs-number fix made the
      // OWNERSHIP GUARD short-circuit BEFORE reaching the cascade —
      // i.e. the spec asserted 200 (so the cascade was reachable)
      // but every run hit the EntityPropertyNotFoundError on the
      // first cascade delete and the suite quietly moved on because
      // the spec's Positive it-block asserts on `expect(200)` AFTER
      // the cascade, so the 500 should have tripped it. Reviewing
      // the round-3 retry sequence showed the spec was passing
      // because `assertChildCountIsZero` went silently green against
      // a roll-back graph where child rows still existed — a bug
      // IN the spec itself, masked by the cascade's silent failure.
      //
      // The codebase convention (verified in
      // `apps/api/src/adapters/dashboard/persistence/transaction.repository.ts:42`,
      // `apps/api/src/adapters/dashboard/persistence/budget.repository.ts:34`,
      // `apps/api/src/adapters/dashboard/persistence/expense-category.repository.ts:20`)
      // is `{ user: { id: <id> } }` for entity-traversal in `where`
      // criteria. TypeORM translates the relation path to the FK
      // column at SQL generation time (`WHERE "userId" = $1`), so
      // this is the canonical-and-correct shape. The literal-
      // column shape `{ userId: <id> }` only works for entities
      // that ALSO declare `@Column({ name: 'userId' }) userId: number`
      // alongside the relation — NOT the case anywhere in this
      // codebase today. Pin this canonical form here so a future
      // contributor who mirrors the pattern in another
      // `tx.delete(Entity, ...)` call site uses the relation shape.
      await tx.delete(UserSettings, { user: { id } });
      await tx.delete(Transaction, { user: { id } });
      await tx.delete(Budget, { user: { id } });
      await tx.delete(ExpenseCategory, { user: { id } });
      await tx.delete(Overview, { user: { id } });

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
