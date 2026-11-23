/**
 * Regression tests for the transaction handlers fixed in audit T0.7 / T0.8.
 *
 * - `updateTransaction` answered 200 without awaiting the write (I1).
 * - `deleteAllTransactions` crashed on a body without `.transactions` (I2).
 * - An unknown/foreign id on PUT surfaced TypeORM's `EntityNotFoundError` as a
 *   500 instead of a 404 (the filter was only registered on the categories
 *   controller).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { EntityNotFoundError } from 'typeorm';
import request = require('supertest');
import { TransactionController } from '@adapters/dashboard/http/transaction.controller';
import { TransactionService } from '@application/dashboard/services/transaction.service';
import { LoggingService } from '@infrastructure/log/logger.service';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { Transaction } from '@domain/dashboard/transaction.entity';

const loggerMock = () => ({
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
});

describe('TransactionController', () => {
  let controller: TransactionController;
  let svc: jest.Mocked<TransactionService>;

  const req = { user: { userId: 1 } } as any;

  beforeEach(async () => {
    svc = {
      updateTransaction: jest.fn(),
      deleteAllTransactions: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        { provide: TransactionService, useValue: svc },
        { provide: LoggingService, useValue: loggerMock() },
      ],
    }).compile();

    controller = module.get(TransactionController);
  });

  it('updateTransaction: propagates a failed write instead of answering 200 (regression: missing await)', async () => {
    const dto = { id: 7, description: 'Edited row', amount: 12.5 } as any;
    svc.updateTransaction.mockRejectedValue(new Error('write failed'));

    await expect(controller.updateTransaction(dto, req)).rejects.toThrow(
      'write failed',
    );
  });

  it('deleteAllTransactions: forwards `{ transactions }` and tolerates an empty body', async () => {
    // The web client always sends `{ transactions: [...] }`; a DELETE without a
    // parsed body must not reach the service as `undefined`.
    await controller.deleteAllTransactions(req, { transactions: [4] } as any);
    await controller.deleteAllTransactions(req, {} as any);

    expect(svc.deleteAllTransactions).toHaveBeenNthCalledWith(1, 1, [4]);
    expect(svc.deleteAllTransactions).toHaveBeenNthCalledWith(2, 1, []);
  });
});

/**
 * HTTP-level check for the status code: it goes through Nest's exception layer,
 * so it fails if `@UseFilters(EntityNotFoundExceptionFilter)` is dropped from
 * the controller — which is exactly the regression that produced a 500.
 */
describe('TransactionController (HTTP)', () => {
  let app: INestApplication;
  let svc: jest.Mocked<TransactionService>;

  const asUser1 = {
    canActivate: (ctx: any) => {
      ctx.switchToHttp().getRequest().user = { userId: 1 };
      return true;
    },
  };

  beforeAll(async () => {
    svc = {
      updateTransaction: jest.fn(),
      deleteAllTransactions: jest.fn(),
    } as any;

    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        { provide: TransactionService, useValue: svc },
        { provide: LoggingService, useValue: loggerMock() },
      ],
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

  it('PUT /transactions on an unknown id answers 404, not 500', async () => {
    svc.updateTransaction.mockRejectedValue(
      new EntityNotFoundError(Transaction, { id: 99999999 }),
    );

    await request(app.getHttpServer())
      .put('/transactions')
      .send({
        id: 99999999,
        date: '2026-11-23',
        description: 'ghost',
        category: 'Food',
        amount: 1,
      })
      .expect(404);
  });
});
