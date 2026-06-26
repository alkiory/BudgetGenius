/**
 * HTTP-level ownership isolation tests for ExpenseCategoryController.
 *
 * These tests exercise the *real* HTTP boundary — translating through
 * Nest's routing, validation pipe, JWT guard, and exception filter — so
 * the multi-tenant guarantee is locked in at the wire level, not just
 * the service mock level.
 *
 * The companion service-level tests (`expense-category-service.spec.ts`)
 * verify service-side correctness against a mocked repo; this file
 * verifies that the controller + filter + pipe chain produces the right
 * status code for cross-user attempts:
 *
 *   - GET /expense-categories       (own user)         → 200 + array
 *   - GET /expense-categories/:id   (foreign id)       → 404 (NOT 500)
 *   - POST /expense-categories      (own user)         → 201 + body
 *   - PUT /expense-categories/:id   (own id, valid)    → 200 + body
 *   - PUT /expense-categories/:id   (foreign id)       → 404
 *   - DELETE /expense-categories/:id (foreign id)      → 200 (silent no-op)
 *
 * The 404 status code is the security property: Nest's default filter
 * maps TypeORM's EntityNotFoundError to 500 — the dedicated
 * EntityNotFoundExceptionFilter must be in scope for these tests to
 * pass. That's the regression detector for "did we wire the filter?".
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  NotFoundException,
} from '@nestjs/common';
import { EntityNotFoundError } from 'typeorm';
// CJS-style import matches `apps/api/test/app.e2e-spec.ts` so ts-jest's
// CommonJS transformer resolves the default call-shape correctly. An
// ESM-style `import request from 'supertest'` returns the namespace
// object in this config and `request(...)` throws `(0 , supertest_1.default)
// is not a function`.
import request = require('supertest');
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { ExpenseCategoryController } from '@adapters/dashboard/http/expense-category.controller';
import { ExpenseCategoryService } from '@application/dashboard/services/expense-category.service';
import { EntityNotFoundExceptionFilter } from '@adapters/dashboard/http/filters/entity-not-found.filter';

describe('ExpenseCategoryController (HTTP)', () => {
  let app: INestApplication;
  let svc: jest.Mocked<ExpenseCategoryService>;

  // Simulates a JWT-authenticated request as user 1.
  const asUser1 = {
    canActivate: (ctx: any) => {
      ctx.switchToHttp().getRequest().user = { userId: 1 };
      return true;
    },
  };
  const asUser2 = {
    canActivate: (ctx: any) => {
      ctx.switchToHttp().getRequest().user = { userId: 2 };
      return true;
    },
  };

  beforeEach(async () => {
    svc = {
      createExpenseCategory: jest.fn(),
      getExpenseCategoriesByUser: jest.fn(),
      updateExpenseCategory: jest.fn(),
      deleteExpenseCategory: jest.fn(),
      getExpenseCategoryById: jest.fn(),
    } as any;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ExpenseCategoryController],
      providers: [{ provide: ExpenseCategoryService, useValue: svc }],
    })
      // Override the real JWT guard with a controllable stub. The stub
      // writes `req.user` directly so we can simulate any caller without
      // wiring a real JWT round-trip.
      .overrideGuard(JwtAuthGuard)
      .useValue(asUser1)
      .compile();

    app = moduleFixture.createNestApplication();
    // ValidationPipe mirrors the production app so DTO shape errors
    // (missing `name`, wrong type on `value`) produce 400s, not 500s.
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('list: GET /expense-categories', () => {
    it("returns only the requesting user's rows", async () => {
      const ownRows = [
        { id: 1, name: 'Food', value: 250, userId: 1 },
        { id: 2, name: 'Transport', value: 100, userId: 1 },
      ];
      svc.getExpenseCategoriesByUser.mockResolvedValue(ownRows as any);

      const res = await request(app.getHttpServer())
        .get('/expense-categories')
        .expect(200);

      expect(res.body).toHaveLength(2);
      // Service MUST receive the JWT userId, not anything else.
      expect(svc.getExpenseCategoriesByUser).toHaveBeenCalledWith(1);
      // Foreign row (userB-owned id 999) is naturally absent.
      expect((res.body as any[]).find((c) => c.id === 999)).toBeUndefined();
    });
  });

  describe('getById: GET /expense-categories/:id', () => {
    it('returns 200 for a row owned by the caller', async () => {
      svc.getExpenseCategoryById.mockResolvedValue({
        id: 1,
        name: 'Food',
        value: 250,
      } as any);

      await request(app.getHttpServer())
        .get('/expense-categories/1')
        .expect(200)
        .expect((r) => {
          expect(r.body).toMatchObject({ id: 1, name: 'Food' });
        });

      expect(svc.getExpenseCategoryById).toHaveBeenCalledWith(1, 1);
    });

    it('returns 404 when the service throws "Expense category not found"', async () => {
      // After the post-audit fix, the service's local-list scan throws
      // Nest's `NotFoundException` on miss — both truly-missing and
      // foreign ids land on the same path. Nest's default filter maps
      // NotFoundException → 404, which is what the cross-user guarantee
      // requires.
      svc.getExpenseCategoryById.mockRejectedValue(
        new NotFoundException('Expense category not found'),
      );

      await request(app.getHttpServer())
        .get('/expense-categories/999')
        .expect(404);
    });
  });

  describe('create: POST /expense-categories', () => {
    it('returns 201 with the created row for a valid payload', async () => {
      const created = { id: 7, name: 'Healthcare', value: 300, userId: 1 };
      svc.createExpenseCategory.mockResolvedValue(created as any);

      const res = await request(app.getHttpServer())
        .post('/expense-categories')
        .send({ name: 'Healthcare', value: 300 })
        .expect(201);

      expect(res.body).toMatchObject({ id: 7, name: 'Healthcare' });
      expect(svc.createExpenseCategory).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: 'Healthcare', value: 300 }),
      );
    });

    it('returns 400 on a payload missing required fields (ValidationPipe)', async () => {
      await request(app.getHttpServer())
        .post('/expense-categories')
        .send({ value: 300 }) // missing `name`
        .expect(400);
      // Service is never called when the DTO fails validation.
      expect(svc.createExpenseCategory).not.toHaveBeenCalled();
    });
  });

  describe('update: PUT /expense-categories/:id', () => {
    it('returns 200 for a row owned by the caller', async () => {
      svc.updateExpenseCategory.mockResolvedValue({
        id: 1,
        name: 'Food+Drinks',
        value: 275,
      } as any);

      await request(app.getHttpServer())
        .put('/expense-categories/1')
        .send({ name: 'Food+Drinks', value: 275 })
        .expect(200)
        .expect((r) => {
          expect(r.body).toMatchObject({ name: 'Food+Drinks' });
        });

      // The path :id MUST be the value forwarded to the service, not
      // anything from the body (defence against body-id-vs-path-id drift).
      expect(svc.updateExpenseCategory).toHaveBeenCalledWith(
        1, // userId from JWT
        expect.objectContaining({
          id: 1, // path :id, forwarded
          name: 'Food+Drinks',
          value: 275,
        }),
      );
    });

    it('returns 404 (NOT 500) when the foreign id bubbles EntityNotFoundError', async () => {
      // Simulate the user-2-as-user-1 attack: user 1 attempts to update
      // category 999 which is owned by user 2. The repo's findOneOrFail
      // raises EntityNotFoundError. Without the filter, this maps to 500.
      // With the filter, it maps to 404.
      svc.updateExpenseCategory.mockRejectedValue(
        new EntityNotFoundError('ExpenseCategory', {
          id: 999,
          user: { id: 1 },
        }),
      );

      await request(app.getHttpServer())
        .put('/expense-categories/999')
        .send({ name: 'Hijacked', value: 99999 })
        .expect(404);
    });

    it('returns 400 on an invalid payload', async () => {
      await request(app.getHttpServer())
        .put('/expense-categories/1')
        .send({ name: '', value: 'not-a-number' })
        .expect(400);
      expect(svc.updateExpenseCategory).not.toHaveBeenCalled();
    });
  });

  describe('delete: DELETE /expense-categories/:id', () => {
    it('returns 200 for an own row', async () => {
      svc.deleteExpenseCategory.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/expense-categories/1')
        .expect(200);

      // The service MUST receive the foreign id AND userId. A regression
      // to a flat `delete(id)` would surface here.
      expect(svc.deleteExpenseCategory).toHaveBeenCalledWith(1, 1);
    });

    it('returns 404 (NOT 500) on a foreign id producing EntityNotFoundError', async () => {
      // Repo doesn't actually throw on the delete path (silent no-op),
      // but if the service were extended later to fail-loud for foreign
      // ids, the filter would still produce a clean 404 — guarded test.
      svc.deleteExpenseCategory.mockRejectedValue(
        new EntityNotFoundError('ExpenseCategory', {
          id: 999,
          user: { id: 1 },
        }),
      );

      await request(app.getHttpServer())
        .delete('/expense-categories/999')
        .expect(404);
    });
  });

  /**
   * JWT-scope regression probe. If a future refactor accidentally drops
   * `req.user.userId` forwarding, these tests fail — the service mocks
   * assert the userId argument explicitly so any drift between caller
   * intent and propagated userId is caught.
   */
  describe('JWT userId is the source of truth', () => {
    it("user 2 cannot read user 1's category list", async () => {
      // Re-bind guard as user 2 mid-suite to assert isolation switch.
      await app.close(); // restart so the override takes effect

      const moduleFixture: TestingModule = await Test.createTestingModule({
        controllers: [ExpenseCategoryController],
        providers: [{ provide: ExpenseCategoryService, useValue: svc }],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(asUser2)
        .compile();

      const app2 = moduleFixture.createNestApplication();
      app2.useGlobalPipes(
        new ValidationPipe({ transform: true, whitelist: true }),
      );
      await app2.init();

      svc.getExpenseCategoriesByUser.mockResolvedValue([
        { id: 5, name: 'User2-Food', value: 100 },
      ] as any);

      await request(app2.getHttpServer())
        .get('/expense-categories')
        .expect(200)
        .expect((r) => {
          expect(svc.getExpenseCategoriesByUser).toHaveBeenLastCalledWith(2);
        });

      await app2.close();
      // Reinstate the user1 guard for any subsequent beforeEach in this
      // suite (jest will refire beforeEach against the same `app`).
    });
  });
});
