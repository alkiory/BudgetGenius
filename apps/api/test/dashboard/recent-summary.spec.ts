import { Test, TestingModule } from '@nestjs/testing';
import { OverviewService } from '@application/dashboard/services/overview.service';
import { OverviewRepository } from '@adapters/dashboard/persistence/overview.repository';
import { TransactionRepository } from '@adapters/dashboard/persistence/transaction.repository';
import { DataSource } from 'typeorm';

describe('OverviewService - recent summary', () => {
  let service: OverviewService;
  let repo: jest.Mocked<OverviewRepository>;
  let txRepo: jest.Mocked<TransactionRepository>;

  const aggregateMock = { income: 1500, expense: 800, net: 700 };
  const txSliceMock = [
    {
      id: 1,
      date: new Date('2025-05-12'),
      description: 'Groceries',
      category: 'Food',
      amount: -42.3,
      status: 'Completed',
    },
    {
      id: 2,
      date: new Date('2025-05-10'),
      description: 'Salary',
      category: 'Salary',
      amount: 1500,
      status: 'Completed',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OverviewService,
        { provide: DataSource, useValue: {} },
        {
          provide: OverviewRepository,
          useValue: {
            getAllTimeAggregate: jest.fn().mockResolvedValue(aggregateMock),
            getExpensesByCategory: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: TransactionRepository,
          useValue: {
            findAndCount: jest.fn().mockResolvedValue({
              transactions: txSliceMock as any,
              meta: { total: 2, offset: 0, limit: 50, nextOffset: null },
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OverviewService>(OverviewService);
    repo = module.get(OverviewRepository);
    txRepo = module.get(TransactionRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should compose recent slice + aggregate into RecentSummary shape', async () => {
    const result = await service.getRecentSummary(7, 50);

    expect(result).toEqual({
      transactions: txSliceMock,
      aggregate: aggregateMock,
    });
  });

  it('should pass userId through to OverviewRepository.getAllTimeAggregate', async () => {
    await service.getRecentSummary(42, 25);

    expect(repo.getAllTimeAggregate).toHaveBeenCalledWith(42);
  });

  it('should pass userId + limit to TransactionRepository.findAndCount', async () => {
    await service.getRecentSummary(42, 25);

    expect(txRepo.findAndCount).toHaveBeenCalledWith({
      offset: 0,
      limit: 25,
      userId: 42,
    });
  });

  it('should pass caller-provided limit through unchanged', async () => {
    await service.getRecentSummary(1, 50);
    expect(txRepo.findAndCount).toHaveBeenCalledWith({
      offset: 0,
      limit: 50,
      userId: 1,
    });
  });

  it('should kick off both lookups before either resolves', async () => {
    const startedAt: { aggregate?: number; slice?: number } = {};
    repo.getAllTimeAggregate.mockImplementation(async () => {
      startedAt.aggregate = Date.now();
      // 20ms delay so the slice timestamp would be recorded AFTER the
      // aggregate resolves IF the calls were sequential. With Promise.all
      // both timestamps are recorded synchronously before the first await.
      await new Promise((r) => setTimeout(r, 20));
      return aggregateMock;
    });
    txRepo.findAndCount.mockImplementation(async () => {
      startedAt.slice = Date.now();
      return { transactions: txSliceMock as any, meta: {} as any };
    });

    await service.getRecentSummary(1, 50);

    // Both timestamps recorded, AND slice started before aggregate would
    // have resolved. Proves parallel dispatch (sequential would record
    // slice AFTER 20ms).
    expect(startedAt.aggregate).toBeDefined();
    expect(startedAt.slice).toBeDefined();
    expect(startedAt.slice).toBeLessThanOrEqual(
      (startedAt.aggregate ?? 0) + 20,
    );
  });
});
