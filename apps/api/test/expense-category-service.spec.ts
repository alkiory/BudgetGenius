/**
 * Cross-user ownership isolation tests for ExpenseCategoryService.
 *
 * These tests lock in the multi-tenant guarantee for the
 * ExpenseCategory write paths. The repo's WHERE clause is the source of
 * truth — defence in depth atop any controller-level userId forwarding.
 *
 * Post-audit contract:
 *   - getExpenseCategoriesByUser: returns ONLY the requesting user's list
 *     (repo filters by `user.id`); a foreign row is naturally absent.
 *   - getExpenseCategoryById: scans the user's own list; foreign ids are
 *     treated as "not found" — caller sees `Error('Expense category not found')`.
 *   - updateExpenseCategory: repo's `findOneOrFail` throws
 *     `EntityNotFoundError` on miss; service lets it bubble — controller
 *     surfaces 500 today, but the multi-tenant isolation (no foreign row
 *     returned) is the security property under test here.
 *   - deleteExpenseCategory: repo's WHERE-scoped DELETE is silent on miss
 *     (no exception); service treats it as a no-op success.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EntityNotFoundError } from 'typeorm';
import { ExpenseCategoryService } from '@application/dashboard/services/expense-category.service';
import { ExpenseCategoryRepository } from '@adapters/dashboard/persistence/expense-category.repository';
import { TransactionRepository } from '@adapters/dashboard/persistence/transaction.repository';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';

// Minimal Owner — only the fields the service actually reads.
// Cast to `any` so the fixture compiles without hauling in the full
// User entity shape (decoration hooks, relations, etc.) — the service
// only inspects `user.id` and `user.expenseCategories` for the paths
// under test here.
const ownerUser: any = {
  id: 1,
  email: 'a@test.com',
  expenseCategories: [],
};

const userAOwnedCategory: any = {
  id: 1,
  name: 'Food',
  value: 250,
  user: ownerUser,
};

describe('ExpenseCategoryService', () => {
  let service: ExpenseCategoryService;
  let expenseRepo: jest.Mocked<ExpenseCategoryRepository>;
  let userRepo: jest.Mocked<UserRepositoryImpl>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseCategoryService,
        {
          provide: ExpenseCategoryRepository,
          useValue: {
            create: jest.fn(),
            findByUser: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByName: jest.fn(),
          },
        },
        // TransactionRepository is a hard dep of ExpenseCategoryService
        // (via the constructor), so we must register a stub even though
        // none of the ownership-isolation tests exercise it — otherwise
        // Nest will fail to resolve the provider graph. The stub is
        // intentionally minimal.
        {
          provide: TransactionRepository,
          useValue: {
            findByUser: jest.fn(),
          },
        },
        {
          provide: UserRepositoryImpl,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ExpenseCategoryService>(ExpenseCategoryService);
    expenseRepo = module.get(ExpenseCategoryRepository);
    userRepo = module.get(UserRepositoryImpl);
  });

  describe('ownership/cross-user isolation', () => {
    const userAId = 1;
    const foreignCategoryId = 999; // owned by userB (2)

    it('updateExpenseCategory: foreign id is rejected (no foreign row written)', async () => {
      userRepo.findById.mockResolvedValue(ownerUser);
      // Repo contract: findOneOrFail → EntityNotFoundError on miss.
      // The service has no try/catch — the error bubbles. From a
      // multi-tenant isolation standpoint this is correct: the foreign
      // row is NOT returned, NOT mutated; the caller has no path to
      // ownership existence via the response payload.
      expenseRepo.update.mockRejectedValue(
        new EntityNotFoundError('ExpenseCategory', {
          id: foreignCategoryId,
          user: { id: userAId },
        }),
      );

      await expect(
        service.updateExpenseCategory(userAId, {
          id: foreignCategoryId,
          name: 'Hijacked',
          value: 99999,
          transactions: [],
        } as any),
      ).rejects.toThrow();

      // The repo MUST receive the owning user's id, not the dto's id.
      // That's the line that ensures the WHERE clause scopes by user.
      expect(expenseRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: foreignCategoryId }),
        userAId,
      );
    });

    it('updateExpenseCategory: success path still scopes by the requesting user', async () => {
      userRepo.findById.mockResolvedValue(ownerUser);
      expenseRepo.update.mockResolvedValue({
        ...userAOwnedCategory,
        name: 'Renamed',
      });

      await service.updateExpenseCategory(userAId, {
        id: 1,
        name: 'Renamed',
        value: 300,
        transactions: [],
      } as any);

      // Even on the happy path, the userId argument must be the
      // caller's — proves the service never falls back to the dto.
      expect(expenseRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, name: 'Renamed' }),
        userAId,
      );
    });

    it('deleteExpenseCategory: foreign id is a silent no-op (caller gets no row data)', async () => {
      userRepo.findById.mockResolvedValue(ownerUser);
      // Repo contract: silent on miss (no exception, returns void).
      expenseRepo.delete.mockResolvedValue(undefined);

      const result = await service.deleteExpenseCategory(
        userAId,
        foreignCategoryId,
      );

      // The service returns whatever the repo returns — void on no-op.
      expect(result).toBeUndefined();
      // Scope check: a regression to `delete(foreignCategoryId)` would
      // surface here.
      expect(expenseRepo.delete).toHaveBeenCalledWith(
        foreignCategoryId,
        userAId,
      );
    });

    it("getExpenseCategoryById: only returns rows in the requesting user's list", async () => {
      userRepo.findById.mockResolvedValue(ownerUser);
      // The service uses findByUser + local .find() — never reads foreign
      // rows because the repo scopes by user. Foreign ids naturally
      // return as `not found`.
      expenseRepo.findByUser.mockResolvedValue([userAOwnedCategory]);

      // Foreign id → resolves to the "not found" error.
      await expect(
        service.getExpenseCategoryById(userAId, foreignCategoryId),
      ).rejects.toThrow('Expense category not found');

      // Local id → resolves to the actual row from the user's list.
      const found = await service.getExpenseCategoryById(userAId, 1);
      expect(found).toMatchObject({ id: 1, name: 'Food' });

      // The repo must have been called with userAId only — never with
      // the queried id (which would let the repo bypass the user filter).
      expect(expenseRepo.findByUser).toHaveBeenCalledWith(userAId);
      expect(expenseRepo.findByUser).not.toHaveBeenCalledWith(
        userAId,
        foreignCategoryId,
      );
    });

    it('getExpenseCategoriesByUser: never returns rows owned by another user', async () => {
      // Repo scopes by user → naturally returns only userA's rows.
      expenseRepo.findByUser.mockResolvedValue([userAOwnedCategory]);

      const result = await service.getExpenseCategoriesByUser(userAId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 1 });
      // The foreign row MUST NOT be returned.
      expect(result.find((c) => c.id === foreignCategoryId)).toBeUndefined();
      // Sanity: the repo's scoping argument is userAId.
      expect(expenseRepo.findByUser).toHaveBeenCalledWith(userAId);
    });
  });
});
