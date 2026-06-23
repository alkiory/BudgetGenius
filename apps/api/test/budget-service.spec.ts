import { Test, TestingModule } from '@nestjs/testing';
import { BudgetService } from '@application/dashboard/services/budget.service';
import { BudgetRepository } from '@adapters/dashboard/persistence/budget.repository';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LoggingService } from '@infrastructure/log/logger.service';

// Full mock User object matching the User entity
const mockUser = {
  id: 1,
  name: 'Test User',
  surname: 'Test User',
  email: 'test@test.com',
  password: '#Test123',
  authProvider: 'email' as const,
  role: 'user',
  refreshToken: null,
  // isPremium is dormant for MVP launch; defaults to true at the DB column level.
  // Kept in the mock so the literal satisfies the `User` type passthrough (T3.13).
  isPremium: true,
  budgets: [],
  comparePassword: jest.fn(),
  hashPassword: jest.fn(),
  createdAt: new Date(),
  updatedAt: new Date(),
  transactions: [],
  expenseCategories: [],
  savingGoals: [],
  overviews: [],
  settings: [],
  incomes: [],
};

// Full mock User used as the `user` property on Budget entities
const budgetUser = {
  id: 1,
  name: 'Test User',
  surname: 'Test User',
  email: 'test@test.com',
  password: '#Test123',
  authProvider: 'email' as const,
  role: 'user',
  refreshToken: null,
  // Defaults to true post-migration (see IspremiumDefaultTrue).
  isPremium: true,
  budgets: [] as any[],
  comparePassword: jest.fn(),
  hashPassword: jest.fn(),
  createdAt: new Date(),
  updatedAt: new Date(),
  transactions: [],
  expenseCategories: [],
  savingGoals: [],
  overviews: [],
  settings: [],
  incomes: [],
};

// Full mock Budget used as the `budget` property on BudgetCategory entities
const categoryBudget = {
  id: 1,
  name: 'Monthly Budget',
  period: 'Weekly',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-30'),
  totalAllocated: 550,
  totalSpent: 50,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: budgetUser,
  categories: [],
};

// Full mock BudgetCategory
const buildCategory = (overrides: Partial<typeof mockCategoryShape> = {}) => ({
  ...mockCategoryShape,
  ...overrides,
});

const mockCategoryShape = {
  id: 1,
  name: 'Medical',
  allocated: 550,
  spent: 250,
  createdAt: new Date(),
  updatedAt: new Date(),
  budget: { ...categoryBudget },
};

// Full mock Budget
const buildBudget = (overrides: Partial<typeof mockBudgetShape> = {}) => ({
  ...mockBudgetShape,
  ...overrides,
});

const mockBudgetShape = {
  id: 1,
  name: 'Monthly Budget',
  period: 'Weekly',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-30'),
  totalAllocated: 550,
  totalSpent: 50,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { ...budgetUser },
  categories: [{ ...mockCategoryShape }],
};

describe('BudgetService', () => {
  let service: BudgetService;
  let repo: jest.Mocked<BudgetRepository>;
  let userRepo: jest.Mocked<UserRepositoryImpl>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetService,
        {
          provide: BudgetRepository,
          useValue: {
            countByUser: jest.fn(),
            createBudget: jest.fn(),
            createBudgetCategory: jest.fn(),
            findByUser: jest.fn(),
            findById: jest.fn(),
            findByBudgetId: jest.fn(),
            getBudgetCategory: jest.fn(),
            findCategotyQuery: jest.fn(),
            updateBudget: jest.fn(),
            updateBudgetCategory: jest.fn(),
            deleteBudgetCategory: jest.fn(),
            deleteBudget: jest.fn(),
          },
        },
        {
          provide: UserRepositoryImpl,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: LoggingService,
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BudgetService>(BudgetService);
    repo = module.get(BudgetRepository);
    userRepo = module.get(UserRepositoryImpl);
  });

  describe('createBudget', () => {
    it('should create a budget even when totalSpent exceeds totalAllocated', async () => {
      repo.countByUser.mockResolvedValue(0);
      userRepo.findById.mockResolvedValue({ ...mockUser, budgets: [] });
      repo.createBudget.mockResolvedValue(buildBudget());

      const dto = {
        name: 'Over Budget Test',
        period: 'Monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        totalAllocated: 500,
        totalSpent: 600, // spent > allocated — previously would throw
        categories: [{ name: 'Medical', allocated: 500, spent: 600 }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.createBudget(1, dto);

      expect(result).toBeDefined();
      expect(repo.createBudget).toHaveBeenCalled();
    });

    it('should still reject duplicate budget names', async () => {
      const existingBudget = buildBudget({ id: 2, name: 'Duplicate Budget' });
      repo.countByUser.mockResolvedValue(1);
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [existingBudget],
      });

      const dto = {
        name: 'Duplicate Budget',
        period: 'Monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        totalAllocated: 500,
        totalSpent: 0,
        categories: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(service.createBudget(1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getBudgets', () => {
    it('should return budgets even when totalSpent exceeds totalAllocated', async () => {
      const overBudgetCategory = buildCategory({ spent: 850, allocated: 550 });
      const overBudgetBudget = buildBudget({
        totalSpent: 50, // stale DB value, will be recalculated
        totalAllocated: 550,
        categories: [overBudgetCategory],
      });

      repo.findByUser.mockResolvedValue([overBudgetBudget]);
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [overBudgetBudget],
      });

      const result = await service.getBudgets(1);

      // Should NOT throw — recalculation should happen
      expect(result).toHaveLength(1);
      // totalSpent should be recalculated from categories: 850
      expect(result[0].totalSpent).toBe(850);
      // totalAllocated should be recalculated from categories: 550
      expect(result[0].totalAllocated).toBe(550);
    });

    it('should recalculate totalSpent and totalAllocated from categories over stale DB values', async () => {
      const categories = [
        buildCategory({ id: 1, name: 'Food', allocated: 300, spent: 250 }),
        buildCategory({ id: 2, name: 'Transport', allocated: 200, spent: 180 }),
      ];
      const budget = buildBudget({
        totalSpent: 100, // stale DB value
        totalAllocated: 999, // stale DB value, will be overridden
        categories,
      });

      repo.findByUser.mockResolvedValue([budget]);
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [budget],
      });

      const result = await service.getBudgets(1);

      // Both should be recalculated from categories, not from stale DB values
      expect(result[0].totalSpent).toBe(430); // 250 + 180
      expect(result[0].totalAllocated).toBe(500); // 300 + 200, overrides stale 999
    });

    it('should return empty array when user has no budgets', async () => {
      userRepo.findById.mockResolvedValue(mockUser);
      repo.findByUser.mockResolvedValue([]);

      const result = await service.getBudgets(1);
      expect(result).toEqual([]);
    });
  });

  describe('updateBudget', () => {
    it('should update budget even when category.spent exceeds category.allocated', async () => {
      repo.findById.mockResolvedValue(buildBudget());
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [buildBudget()],
      });
      repo.updateBudget.mockResolvedValue(buildBudget());

      const dto = {
        id: 1,
        name: 'Monthly Budget',
        totalAllocated: 550,
        totalSpent: 850,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-30'),
        categories: [
          { id: 1, name: 'Medical', allocated: 550, spent: 850 }, // spent > allocated
        ],
      };

      // Should NOT throw BadRequestException
      const result = await service.updateBudget(1, dto);

      expect(result).toBeDefined();
      expect(repo.updateBudget).toHaveBeenCalled();
    });

    it('should still reject invalid date ranges', async () => {
      repo.findById.mockResolvedValue(buildBudget());
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [buildBudget()],
      });

      const dto = {
        id: 1,
        startDate: new Date('2026-06-30'),
        endDate: new Date('2026-06-01'), // end before start
      };

      await expect(service.updateBudget(1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateBudgetCategory', () => {
    it('should update category spent and recalculate parent budget totalSpent', async () => {
      const existingCategory = buildCategory({
        id: 1,
        allocated: 550,
        spent: 250,
        budget: { ...categoryBudget, id: 1 },
      });

      const budgetWithUpdatedCategory = buildBudget({
        id: 1,
        totalSpent: 250,
        totalAllocated: 550,
        categories: [buildCategory({ ...existingCategory, spent: 850 })],
      });

      repo.getBudgetCategory.mockResolvedValue(existingCategory);
      userRepo.findById.mockResolvedValue(mockUser);
      repo.updateBudgetCategory.mockResolvedValue({
        ...existingCategory,
        spent: 850,
      });
      // After update, recalculate loads budget with categories
      repo.findById.mockResolvedValue(budgetWithUpdatedCategory);
      repo.updateBudget.mockResolvedValue(budgetWithUpdatedCategory);

      const dto = { id: 1, name: 'Medical', allocated: 550, spent: 850 };

      const result = await service.updateBudgetCategory(1, dto);

      expect(result.spent).toBe(850);
      // Should have recalculated the parent budget's totalSpent.
      // The new repo signature forwards userId so the WHERE clause also
      // scopes by owner; the assertion below checks both args so any
      // future signature drift on either parameter is caught.
      expect(repo.findById).toHaveBeenCalledWith(1, 1); // budget id + userId from category owner
      expect(repo.updateBudget).toHaveBeenCalled();
    });

    it('should handle overspend without error — spent can exceed allocated', async () => {
      const category = buildCategory({
        id: 1,
        allocated: 550,
        spent: 250,
        budget: { ...categoryBudget, id: 1 },
      });

      repo.getBudgetCategory.mockResolvedValue(category);
      userRepo.findById.mockResolvedValue(mockUser);
      repo.updateBudgetCategory.mockResolvedValue({ ...category, spent: 1200 });
      repo.findById.mockResolvedValue(
        buildBudget({
          categories: [buildCategory({ ...category, spent: 1200 })],
        }),
      );
      repo.updateBudget.mockResolvedValue({} as any);

      const dto = { id: 1, name: 'Medical', allocated: 550, spent: 1200 };

      // Should NOT throw — users can spend whatever they want
      const result = await service.updateBudgetCategory(1, dto);

      expect(result.spent).toBe(1200);
    });

    it('should still reject non-existent category', async () => {
      repo.getBudgetCategory.mockRejectedValue(
        new NotFoundException('Category 999 not found'),
      );

      await expect(
        service.updateBudgetCategory(1, {
          id: 999,
          name: 'Ghost',
          allocated: 0,
          spent: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  /**
   * Cross-user ownership isolation. These tests lock in the post-audit
   * contract: any attempt by user A to touch a row owned by user B
   * either throws NotFoundException (fetches / updates) or is a silent
   * no-op (deletes). They never leak the foreign row, never return it,
   * and never expose a 403 that would let a caller probe for ownership
   * existence by status-code inference.
   */
  describe('ownership/cross-user isolation', () => {
    const userAId = 1;
    const userBId = 2;
    const foreignBudgetId = 999; // owned by userB
    const foreignCategoryId = 888; // owned by userB inside userB's budget

    beforeEach(() => {
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [buildBudget({ id: 1, user: { id: userAId, ...budgetUser } })],
      });
    });

    it('getBudget: foreign-id attempt does not return the row', async () => {
      // Repo throws on miss (no foreign row visible) — defence in depth.
      repo.findById.mockRejectedValue(
        new NotFoundException(`Budget ${foreignBudgetId} not found`),
      );

      await expect(
        service.getBudget(foreignBudgetId, userAId),
      ).rejects.toThrow(NotFoundException);

      // Scope must include both id AND userId; a future regression that
      // drops `userId` would still appear to "work" by accident, so we
      // pin the full argument shape.
      expect(repo.findById).toHaveBeenCalledWith(foreignBudgetId, userAId);
    });

    it('getBudgetCategory: foreign-id attempt does not return the row', async () => {
      repo.getBudgetCategory.mockRejectedValue(
        new NotFoundException(`Budget category ${foreignCategoryId} not found`),
      );

      await expect(
        service.getBudgetCategory(foreignCategoryId, userAId),
      ).rejects.toThrow(NotFoundException);
      expect(repo.getBudgetCategory).toHaveBeenCalledWith(
        foreignCategoryId,
        userAId,
      );
    });

    it('updateBudget: attempt to mutate a foreign budget is rejected', async () => {
      repo.findById.mockRejectedValue(
        new NotFoundException(`Budget ${foreignBudgetId} not found`),
      );

      const dto = {
        id: foreignBudgetId,
        name: 'Hijacked',
        totalAllocated: 1000,
        totalSpent: 0,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        categories: [],
      };

      await expect(service.updateBudget(userAId, dto)).rejects.toThrow(
        NotFoundException,
      );

      // Repo.updateBudget must NEVER be reached once findById throws.
      expect(repo.updateBudget).not.toHaveBeenCalled();
    });

    it('updateBudgetCategory: attempt to mutate a foreign category is rejected', async () => {
      repo.getBudgetCategory.mockRejectedValue(
        new NotFoundException(`Category ${foreignCategoryId} not found`),
      );

      const dto = {
        id: foreignCategoryId,
        name: 'Hijacked',
        allocated: 1000,
        spent: 0,
      };

      await expect(
        service.updateBudgetCategory(userAId, dto),
      ).rejects.toThrow(NotFoundException);
      expect(repo.updateBudgetCategory).not.toHaveBeenCalled();
      // Recompute side-effect must also be skipped.
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it('deleteBudget: foreign-id attempt is a silent no-op', async () => {
      // Repo contract: void on silent no-op. No throw, no row deleted.
      repo.deleteBudget.mockResolvedValue(undefined);

      const result = await service.deleteBudget(userAId, foreignBudgetId);

      expect(result).toBeUndefined();
      // Repo must receive the userId so the WHERE clause scopes the
      // DELETE statement; otherwise we'd hit a flat
      // `delete({id: foreignBudgetId})` — which would be a privilege
      // escalation.
      expect(repo.deleteBudget).toHaveBeenCalledWith(foreignBudgetId, userAId);
    });

    it('deleteBudgetCategory: foreign-id attempt is a silent no-op', async () => {
      repo.deleteBudgetCategory.mockResolvedValue(undefined);

      const result = await service.deleteBudgetCategory(
        userAId,
        foreignCategoryId,
      );

      expect(result).toEqual({ message: 'Category deleted successfully' });
      expect(repo.deleteBudgetCategory).toHaveBeenCalledWith(
        foreignCategoryId,
        userAId,
      );
    });

    it('createBudgetCategory: appending to a foreign budget is rejected', async () => {
      // The defence-in-depth ownership check (`repo.findById(budgetId, userId)`)
      // throws if the budget does not belong to userA. The repo's
      // NotFoundException bubbles; createBudgetCategory never reaches
      // the DB write.
      repo.findById.mockRejectedValue(
        new NotFoundException(`Budget ${foreignBudgetId} not found`),
      );
      repo.findCategotyQuery.mockResolvedValue([]);

      await expect(
        service.createBudgetCategory({
          userId: userAId,
          budgetId: foreignBudgetId,
          dto: {
            name: 'Smuggled',
            allocated: 1000,
            spent: 0,
          } as any,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(repo.createBudgetCategory).not.toHaveBeenCalled();
    });

    it('findCategories: filtering by a foreign budgetId is rejected', async () => {
      // The service eagerly checks `user.budgets.find(b.id === budgetId)`
      // before hitting the repo. This guards against a user enumerating
      // other users' budget ids via the categories endpoint.
      // A foreign budgetId trips the guard and throws NotFoundException
      // before the repo is called. The `expect(...).rejects.toThrow()`
      // assertion also makes the rejection observable to the runner
      // (a bare `await` followed by an assertion would re-throw and
      // fail the test on the assignment line, not on intent).
      await expect(
        service.findCategories({
          userId: userAId,
          budgetId: foreignBudgetId,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
