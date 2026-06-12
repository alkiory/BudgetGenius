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
    status: 'completed',
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
            findByUser: jest.fn().mockResolvedValue({ id: 1, email: 'test@test.com' } as any),
            findOne: jest.fn().mockResolvedValue(mockTransaction),
            update: jest.fn().mockResolvedValue(mockTransaction),
            delete: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: UserRepositoryImpl,
          useValue: {
            findById: jest.fn().mockResolvedValue({ id: 1, email: 'test@test.com' }),
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
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.createTransaction(1, dto);

      expect(result).toEqual(mockTransaction);
      expect(repo.create).toHaveBeenCalledWith({
        ...dto,
        user: { id: 1 },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should throw an error when creation fails', async () => {
      repo.create = jest.fn().mockRejectedValue(new Error('DB Error'));

      await expect(service.createTransaction(1, {} as any)).rejects.toThrow(
        'DB Error',
      );
    });
  });
});
