// test/transaction.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from '@application/dashboard/services/transaction.service';
import { TransactionRepository } from '@adapters/dashboard/persistence/transaction.repository';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';

describe('TransactionService', () => {
  let service: TransactionService;
  let repo: TransactionRepository;

  // Mock data
  const mockTransaction = {
    id: 1,
    date: new Date(),
    description: 'Test Transaction',
    category: 'Food',
    amount: 100,
    recurrence: null,
    userId: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: TransactionRepository,
          useValue: {
            create: jest.fn().mockResolvedValue(mockTransaction),
            findByUser: jest
              .fn()
              .mockResolvedValue({ id: 1, email: 'test@test.com' } as any),
            findOne: jest.fn().mockResolvedValue(mockTransaction),
            update: jest.fn().mockResolvedValue(mockTransaction),
            delete: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: UserRepositoryImpl,
          useValue: {
            findById: jest
              .fn()
              .mockResolvedValue({ id: 1, email: 'test@test.com' }),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    repo = module.get<TransactionRepository>(TransactionRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTransaction', () => {
    it('should create a transaction successfully', async () => {
      const dto = {
        date: new Date(),
        description: 'Test',
        category: 'Food',
        amount: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.createTransaction(1, dto);

      expect(result).toEqual(mockTransaction);
      // After Phase 1, the service normalizes `recurrence: dto.recurrence ?? null`
      // so the repo's nullable column contract is satisfied. Use objectContaining
      // so the test isn't fragile to future unrelated field additions.
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...dto,
          user: { id: 1 },
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          recurrence: null,
        }),
      );
    });

    it('should throw an error when creation fails', async () => {
      repo.create = jest.fn().mockRejectedValue(new Error('DB Error'));

      await expect(service.createTransaction(1, {} as any)).rejects.toThrow(
        'DB Error',
      );
    });

    it('should persist recurrence when provided', async () => {
      const dto = {
        date: new Date(),
        description: 'Salary',
        category: 'Salary',
        amount: 1000,
        recurrence: 'Monthly',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await service.createTransaction(1, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ recurrence: 'Monthly' }),
      );
    });

    it('should leave recurrence null when omitted', async () => {
      const dto = {
        date: new Date(),
        description: 'Coffee',
        category: 'Food',
        amount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await service.createTransaction(1, dto);

      // After Phase 1, the service normalizes `recurrence: dto.recurrence ?? null`
      // on the create path, so a dto without recurrence always lands as null.
      const calledWith = (repo.create as jest.Mock).mock.calls[0][0];
      expect(calledWith.recurrence).toBeNull();
    });
  });

  describe('updateTransaction', () => {
    it('should preserve existing recurrence when update payload omits it', async () => {
      // Seed the mock to look like a row that already has a recurrence value.
      const existingRecurrence = 'Monthly';
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        recurrence: existingRecurrence,
      });

      // Caller sends a partial-update payload WITHOUT a recurrence field —
      // matches what a UI PUT does when the user only edits amount/description.
      // `createdAt` is omitted because the service signature is
      // `Omit<UpdateTransactionDto, "createdAt">`.
      const dto = {
        id: mockTransaction.id,
        date: new Date(),
        description: 'Salary payment',
        category: 'Salary',
        amount: 1000,
      };

      await service.updateTransaction(1, dto);

      // The repo's `update` must receive the argument WITHOUT a `recurrence`
      // key (so its destructuring reads `undefined` and the partial-update
      // contract kicks in — preserving the existing value).
      const calledArg = (repo.update as jest.Mock).mock.calls[0][0];
      expect('recurrence' in calledArg).toBe(false);
    });

    it('should clear recurrence when explicit null is provided', async () => {
      // Seed: a row that previously had a recurrence.
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        recurrence: 'Monthly',
      });

      // Caller explicitly wants to clear it (recurrence: undefined flows
      // through spread, so the test must include the key with value null).
      const dto = {
        id: mockTransaction.id,
        date: new Date(),
        description: 'Salary payment',
        category: 'Salary',
        amount: 1000,
        recurrence: null,
      };

      await service.updateTransaction(1, dto);

      // The dto's explicit null flows through `...dto` spread into the
      // service-built transaction object; the repo sees a non-undefined
      // value and the guard writes it (clearing the existing value).
      const calledArg = (repo.update as jest.Mock).mock.calls[0][0];
      expect(calledArg.recurrence).toBeNull();
      expect('recurrence' in calledArg).toBe(true);
    });
  });
});
