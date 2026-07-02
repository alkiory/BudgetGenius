/**
 * v1.7.3 — regression spec for the production-APK DELETE-permission bug.
 *
 * The previous `user.controller.ts#deleteUser` declared
 *   `@Param('id') id: number`
 * which is a TYPE LIE — NestJS extracts URL path segments as STRINGS
 * regardless of the TypeScript annotation. The Bearer JWT, however,
 * carries `id: <number>` (a numeric claim), so the ownership guard
 *
 *   if (id !== user.id && user.role !== 'admin') { throw …; }
 *
 * compared `"8" !== 8` which is `true` in JavaScript, rejecting every
 * legitimate self-delete on real APK installs. v1.7.3 replaces the
 * annotation with `@Param('id', ParseIntPipe) id: number` (NestJS-
 * idiomatic; malformed ids 400 BEFORE the auth check, no info leak)
 * AND defensively optional-chains `user?.id` / `user?.role`.
 *
 * This spec pins BOTH sides of the contract:
 *
 *   1. Negative — a second user's Bearer token CANNOT delete user A,
 *      AND user A's row must persist (the cross-user check still works).
 *   2. Positive — user A CAN delete themselves, the row is gone from
 *      the database post-delete, AND at least one child-table row is
 *      also gone (proves the v1.7.2 cascade-completeness fix
 *      continues to run).
 *
 * Module-load conventions match the existing `auth-throttle.e2e-spec.ts`
 * pattern — `import request = require('supertest');` rather than the
 * ES-module form, which avoids a ts-jest interop quirk under the
 * current jest.config.ts.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { UserRepositoryImpl } from '../src/adapters/user/persistence/user.repository';

describe('UserController Delete Permission (e2e) — v1.7.3', () => {
  let app: INestApplication;
  let userRepo: UserRepositoryImpl;
  let dataSource: DataSource;

  // Two test fixtures with stable emails for the duration of the suite.
  const EMAIL_A = 'user-a-delete-test@example.com';
  const EMAIL_B = 'user-b-delete-test@example.com';
  const PASSWORD_A = 'PasswordA_v1.7.3!';
  const PASSWORD_B = 'PasswordB_v1.7.3!';

  let userAId: number;
  let tokenA: string;
  let userBId: number;
  let tokenB: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    userRepo = app.get(UserRepositoryImpl);
    dataSource = app.get(DataSource);
    await app.init();

    // Pre-clean: rows from a previously-aborted run could fail the
    // unique-email constraint on /auth/signup. Best-effort direct-SQL
    // delete wrapped in try/catch so a transient DB hiccup does not
    // fail the suite. The queries match the InitialMigration's actual
    // schema (`userId` is double-quoted because Postgres folds
    // unquoted identifiers — see v1.7.2 cascade completeness fix).
    try {
      await dataSource.query(
        `DELETE FROM "bg_public"."user_settings" WHERE "userId" IN (
           SELECT "id" FROM "bg_public"."users" WHERE "email" = ANY($1::text[])
         )`,
        [[EMAIL_A, EMAIL_B]],
      );
      await dataSource.query(
        `DELETE FROM "bg_public"."users" WHERE "email" = ANY($1::text[])`,
        [[EMAIL_A, EMAIL_B]],
      );
    } catch {
      /* best-effort cleanup; missing tables / race conditions tolerated */
    }
  });

  afterAll(async () => {
    // Symmetric post-cleanup so the test DB doesn't accumulate rows
    // across reruns. Try/catch so a previously-passed test's
    // successful delete leaves zero rows, and a previously-failed
    // test's partial state can still be reaped.
    try {
      await dataSource.query(
        `DELETE FROM "bg_public"."user_settings" WHERE "userId" IN (
           SELECT "id" FROM "bg_public"."users" WHERE "email" = ANY($1::text[])
         )`,
        [[EMAIL_A, EMAIL_B]],
      );
      await dataSource.query(
        `DELETE FROM "bg_public"."users" WHERE "email" = ANY($1::text[])`,
        [[EMAIL_A, EMAIL_B]],
      );
    } catch {
      /* best-effort cleanup */
    }
    await app.close();
  });

  it('Setup — signs up two distinct users (User A and User B)', async () => {
    const resA = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'User A',
        surname: 'DeleteTest',
        email: EMAIL_A,
        password: PASSWORD_A,
        authProvider: 'email',
        role: 'user',
      })
      .expect(201);

    userAId = resA.body.user.id;
    tokenA = resA.body.accessToken;
    expect(typeof userAId).toBe('number');
    expect(typeof tokenA).toBe('string');

    const resB = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'User B',
        surname: 'DeleteTest',
        email: EMAIL_B,
        password: PASSWORD_B,
        authProvider: 'email',
        role: 'user',
      })
      .expect(201);

    userBId = resB.body.user.id;
    tokenB = resB.body.accessToken;
    expect(typeof userBId).toBe('number');
    expect(typeof tokenB).toBe('string');
  });

  it('Negative — User B CANNOT delete User A (ownership guard still rejects cross-user attempts)', async () => {
    // The previous (broken) implementation happened to reject this case
    // too — `"<A.id>" !== "<B.id>"` was true AND `"user" !== "admin"`
    // was true, so cross-user was rejected. Lock this case in so a
    // future regression that REMOVES the ownership check still fails
    // this test, not just the positive case.
    const response = await request(app.getHttpServer())
      .delete(`/user/${userAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(401);

    expect(response.body?.message).toMatch(/permission/i);

    // User A row must STILL exist
    const stillExists = await userRepo.findById(userAId);
    expect(stillExists).not.toBeNull();
    expect(stillExists?.id).toBe(userAId);
    expect(stillExists?.email).toBe(EMAIL_A);
  });

  it('Positive — User A CAN delete themselves AND the cascade removes child rows', async () => {
    // Before the v1.7.3 fix this returned 401 with the message
    // "You do not have permission to delete this user" because
    // `id !== user.id` compared strings against a number. v1.7.3
    // ships with `ParseIntPipe` + optional-chained user?.id, the
    // comparison now passes for legit self-deletes.

    // v1.7.3+ — cascade-completeness helper. Used by the
    // Positive `it` block below to assert zero orphan rows in EVERY
    // child table of `users(id)` (the full set per
    // `apps/api/src/migrations/1776510954066-InitialMigration.ts`:
    // transaction / budget / expense_category / overview / user_settings
    // are entity-registered; saving_goals / incomes / goals are legacy
    // raw-SQL pre-check targets). Mirrors the v1.7.2 production-side
    // `deleteLegacyTableIfExists` helper shape exactly so spec and
    // production share the same defensive existence-check idiom.
    const assertChildCountIsZero = async (
      tableName: string,
    ): Promise<void> => {
      const existsResult = await dataSource.query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'bg_public' AND table_name = $1
         )`,
        [tableName],
      );
      // Explicit strict-equality — NOT `Boolean(...)` — handles BOTH
      // observed Postgres return shapes:
      //   • JS boolean `true` (the default `pg` package driver)
      //   • `'t'` string (some `pg-native` / `pg-query-stream` configs)
      // The previous-round shape `Boolean(existsResult[0]?.exists)`
      // was BLOCKING because all non-empty strings are truthy in
      // JavaScript — so `'f'` (meaning "exists=false") would WRONGLY
      // pass the existence-guard and fall through to the count
      // branch against a missing table, throwing `ER_NO_SUCH_TABLE`.
      // The strict `=== true || === 't'` shape correctly rejects
      // `false`, `'f'`, `null`, `undefined`, `0`, and `''` while
      // accepting the two real-world "table exists" representations.
      //
      // RELATION TO PRODUCTION: inspired by the v1.7.2 existence-check
      // idiom in `apps/api/src/adapters/user/persistence/user.repository.ts#deleteUserTransactional`,
      // but the spec's strict-equality shape is MORE defensive than
      // production's loose `if (exists) { … }` (which would ALSO
      // mis-handle `'f'` strings on non-default pg drivers — but
      // never trips in production today because the default `pg`
      // driver returns JS booleans for `EXISTS` aggregate results).
      // The spec's stricter shape is defense-in-depth — if production
      // is later refactored to use the spec's strict shape, the
      // migration is consistent with the test surface.
      const raw = existsResult[0]?.exists;
      const tableExists = raw === true || raw === 't';
      if (!tableExists) {
        // Table dropped by a prior migration (e.g. `goals` was removed
        // by `1800000000000-RemoveGoalsTable.ts`); the cascade fix
        // intentionally skips on missing tables, so the assertion
        // mirrors that and silently no-ops.
        return;
      }
      // SECURITY: `${tableName}` interpolated into the SQL identifier
      // position. Callers must pass hardcoded literals only.
      const countResult = await dataSource.query(
        `SELECT count(*)::int AS count
         FROM "bg_public"."${tableName}"
         WHERE "userId" = $1`,
        [userAId],
      );
      expect(countResult[0]?.count ?? 0).toBe(0);
    };
    // v1.7.4.1 — pre-cascade precondition. Without this assertion a
    // future regression that makes the cascade silently no-op (e.g.,
    // someone reverts to raw SQL inside `deleteUserTransactional`) would
    // still trip `assertChildCountIsZero` green at the post-cascade
    // assertion because the rows were never there to delete in the
    // first place — masking the bug. Verify at least one UserSettings
    // row EXISTS for `userAId` so the cascade has work to do.
    //
    // Why UserSettings specifically: it is the FIRST entity attempted
    // in the cascade (see `apps/api/src/adapters/user/persistence/user.repository.ts#deleteUserTransactional`),
    // and the bug we just fixed (EntityPropertyNotFoundError on the
    // `userId` criteria column) tripped there first. Verifying the
    // precondition on the FIRST entity means the assertion captures the
    // failure mode if any of the 5 cascade lines regress to the broken
    // `{ userId: id }` criteria shape.
    const preCascadeSettingsCount = await dataSource.query(
      `SELECT count(*)::int AS count
       FROM "bg_public"."user_settings"
       WHERE "userId" = $1`,
      [userAId],
    );
    expect(preCascadeSettingsCount[0]?.count ?? 0).toBeGreaterThanOrEqual(1);

    const response = await request(app.getHttpServer())
      .delete(`/user/${userAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(response.body?.message).toBeTruthy();

    // Post-delete assertion #1: parent row must be gone.
    const noUser = await userRepo.findById(userAId);
    expect(noUser).toBeNull();

    // Post-delete assertion #2 — CASCADE COMPLETENESS, BLOCKER E coverage-gap fix.
    //
    // The v1.7.2 RPI shipped a cascade that covers 8 child tables of
    // `users(id)`: 5 entity-based deletes (UserSettings, Transaction, Budget,
    // ExpenseCategory, Overview) + 3 legacy raw-SQL pre-checks via
    // `deleteLegacyTableIfExists` (incomes, goals, saving_goals). The
    // previous (round-3) spec asserted only on 2 of the 8 tables, leaving
    // the other 6 uncovered. This round extends the spec to all 8.
    //
    // Each assertion goes through `assertChildCountIsZero(tableName)`:
    //   - Pre-check `information_schema.tables` for the schema-qualified
    //     `bg_public.<table>` (mirrors the v1.7.2 helper exactly). If the
    //     table was dropped by an earlier migration (e.g. `goals` by
    //     `1800000000000-RemoveGoalsTable.ts`), the assertion silently
    //     no-ops — fresh DBs aren't tripped by missing-history tables.
    //   - If the table exists, `SELECT count(*) WHERE "userId" = $1`
    //     against the now-deleted user's id. Must be 0.
    //
    // SECURITY: `assertChildCountIsZero` interpolates `${tableName}` into
    // the SQL identifier position. Callers MUST pass hardcoded literals
    // (which is exactly what the loop below does). A future caller
    // passing user-supplied input would create an SQL-injection surface.
    await assertChildCountIsZero('user_settings');
    await assertChildCountIsZero('transactions');
    await assertChildCountIsZero('budgets');
    await assertChildCountIsZero('expense_categories');
    await assertChildCountIsZero('overview');
    await assertChildCountIsZero('incomes');
    await assertChildCountIsZero('goals');
    await assertChildCountIsZero('saving_goals');
  });});
