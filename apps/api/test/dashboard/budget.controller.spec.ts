/**
 * Isolation at the HTTP boundary: reconciliation must always be scoped by
 * the authenticated `req.user.userId`, never by a client-supplied id in the
 * query string or body. The service is mocked, so these tests fail if the
 * controller starts forwarding `req.query`/`req.body` instead of the guard's
 * user.
 */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { BudgetController } from '@adapters/dashboard/http/budget.controller';
import { BudgetService } from '@application/dashboard/services/budget.service';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';

describe('BudgetController reconciliation isolation (HTTP)', () => {
  let app: INestApplication;
  let svc: { getReconciliation: jest.Mock; reconcileExpense: jest.Mock };

  const asUser1 = {
    canActivate: (context: any) => {
      context.switchToHttp().getRequest().user = { userId: 1 };
      return true;
    },
  };

  beforeAll(async () => {
    svc = {
      getReconciliation: jest.fn().mockResolvedValue({ total: 0, items: [] }),
      reconcileExpense: jest
        .fn()
        .mockResolvedValue({ id: 999, budgetCategoryId: 49 }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BudgetController],
      providers: [{ provide: BudgetService, useValue: svc }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(asUser1)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /budgets/reconciliation forwards the authenticated user only', async () => {
    await request(app.getHttpServer())
      .get('/budgets/reconciliation')
      .query({ userId: 2 })
      .expect(200);

    expect(svc.getReconciliation).toHaveBeenCalledWith(1);
    expect(svc.getReconciliation).not.toHaveBeenCalledWith(2);
  });

  it('PUT /budgets/reconciliation/:id ignores a client-supplied userId', async () => {
    await request(app.getHttpServer())
      .put('/budgets/reconciliation/999')
      .send({ budgetCategoryId: 49, userId: 2 })
      .expect(200);

    expect(svc.reconcileExpense).toHaveBeenCalledWith(1, 999, 49);
    expect(svc.reconcileExpense).not.toHaveBeenCalledWith(2, 999, 49);
  });
});
