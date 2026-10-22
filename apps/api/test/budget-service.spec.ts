import { Test, TestingModule } from '@nestjs/testing';
import { BudgetService } from '@application/dashboard/services/budget.service';
import { BudgetRepository } from '@adapters/dashboard/persistence/budget.repository';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { LoggingService } from '@infrastructure/log/logger.service';
import { UserSettingsService } from '@application/user/user-settings.service';
import { QueryFailedError } from 'typeorm';
import { BUDGET_CATEGORY_UNIQUE_CONSTRAINT_NAME } from '@domain/dashboard/budget-category.entity';
import { SupportedCurrency } from '@domain/user/user-settings.entity';

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
  type: 'spending' as const,
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
const buildCategory = (overrides: Partial<typeof mockCategoryShape> = {}) => {
  // Legacy fixtures only declare `spent`; before the manual/transaction
  // split that value WAS the manual baseline. Mirror it into manualSpent
  // unless a test is explicitly exercising the split.
  return {
    ...mockCategoryShape,
    ...(overrides.spent !== undefined && overrides.manualSpent === undefined
      ? { manualSpent: overrides.spent }
      : {}),
    ...overrides,
  };
};

const mockCategoryShape = {
  id: 1,
  name: 'Medical',
  allocated: 550,
  spent: 250,
  manualSpent: 250,
  currency: 'USD' as SupportedCurrency,
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
  type: 'spending' as 'spending' | 'savings',
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
  let logger: jest.Mocked<LoggingService>;

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
            sumExpenseAmountsByBudget: jest.fn().mockResolvedValue([]),
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
        {
          provide: UserSettingsService,
          useValue: {
            getOrCreateSettings: jest.fn().mockResolvedValue({
              id: 1,
              timezone: 'UTC',
              currency: 'USD',
              locale: 'en-US',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<BudgetService>(BudgetService);
    repo = module.get(BudgetRepository);
    userRepo = module.get(UserRepositoryImpl);
    logger = module.get(LoggingService);
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

    it('should add transaction spending on top of the manual baseline (spending budget)', async () => {
      const category = buildCategory({
        id: 1,
        name: 'Medical',
        allocated: 500,
        spent: 100,
        manualSpent: 100,
      });
      const budget = buildBudget({
        id: 1,
        type: 'spending',
        categories: [category],
      });

      repo.findByUser.mockResolvedValue([budget]);
      repo.sumExpenseAmountsByBudget.mockResolvedValue([
        { budgetId: 1, category: 'medical', total: 50 },
      ]);
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [budget],
      });

      const result = await service.getBudgets(1);

      expect(result[0].categories[0].manualSpent).toBe(100);
      expect(result[0].categories[0].transactionSpent).toBe(50);
      expect(result[0].categories[0].spent).toBe(150);
      expect(result[0].totalSpent).toBe(150);
    });

    it('should ignore transaction spending for savings budgets', async () => {
      const category = buildCategory({
        id: 1,
        name: 'Transport',
        allocated: 1000,
        spent: 400,
        manualSpent: 400,
      });
      const budget = buildBudget({
        id: 1,
        type: 'savings',
        categories: [category],
      });

      repo.findByUser.mockResolvedValue([budget]);
      repo.sumExpenseAmountsByBudget.mockResolvedValue([
        { budgetId: 1, category: 'transport', total: 75 },
      ]);
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [budget],
      });

      const result = await service.getBudgets(1);

      expect(result[0].categories[0].transactionSpent).toBe(0);
      expect(result[0].categories[0].spent).toBe(400);
      expect(result[0].totalSpent).toBe(400);
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

  describe('ownership/cross-user isolation', () => {
    const userAId = 1;
    // List of canonical test-id constants. `foreignBudgetId` and
    // `foreignCategoryId` are owned by a hypothetical userB (not the
    // current caller) and serve as negative-test inputs across this
    // describe. Their declared `userB` ownership is documented but no
    // userB id is needed in the test bodies — the foreignness is the
    // signal, not a peer user's id.
    const foreignBudgetId = 999; // owned by userB (foreign to userAId)
    const foreignCategoryId = 888; // inside userB's budget
    // Canonical shape of the freshly-created category. Referenced from
    // BOTH the `repo.createBudgetCategory.mockResolvedValue(...)` payload
    // AND the post-create `repo.findById.mockResolvedValue(...)`
    // categories list, so a future intent-change locks both mocks at once
    // (otherwise they'd drift and silently mask a wiring regression).
    const newCategoryShape = {
      id: 42,
      name: 'NewCategory',
      spent: 30,
      allocated: 100,
    };

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

      await expect(service.getBudget(foreignBudgetId, userAId)).rejects.toThrow(
        NotFoundException,
      );

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

      await expect(service.updateBudgetCategory(userAId, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.updateBudgetCategory).not.toHaveBeenCalled();
      // Recompute side-effect must also be skipped.
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it('deleteBudget: foreign-id attempt is a silent no-op', async () => {
      // Repo contract: void on silent no-op. No throw, no row deleted.
      repo.deleteBudget.mockResolvedValue(undefined);

      const result = await service.deleteBudget(userAId, foreignBudgetId);

      expect(result).toBeUndefined();
      expect(repo.deleteBudget).toHaveBeenCalledWith(foreignBudgetId, userAId);
    });

    it('deleteBudgetCategory: foreign-id attempt is a service-level NotFoundException (no repo delete)', async () => {
      // Production path: the service-layer pre-delete lookup rejects
      // the foreign id with NotFoundException BEFORE reaching the repo.
      // This is what the user sees as a clean 404 (not the 500 that the
      // buggy nested-WHERE delete used to throw at the SQL-driver layer).
      repo.getBudgetCategory.mockRejectedValue(
        new NotFoundException(`Budget category ${foreignCategoryId} not found`),
      );

      await expect(
        service.deleteBudgetCategory(userAId, foreignCategoryId),
      ).rejects.toThrow(NotFoundException);
      // Defensive belt-and-suspenders: the repo never sees a category
      // id that wouldn't belong to the user.
      expect(repo.deleteBudgetCategory).not.toHaveBeenCalled();
    });
    it('createBudgetCategory: appending to a foreign budget is rejected', async () => {
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

    it('createBudgetCategory: duplicate-name lookup is scoped via budget.user (NOT a flat user filter)', async () => {
      // Eager user/budget ownership check passes (the user owns the budget).
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [buildBudget({ id: 1, user: { id: userAId, ...budgetUser } })],
      });
      // Repo returns no duplicate; the create call should proceed normally.
      repo.findCategotyQuery.mockResolvedValue([]);
      repo.createBudgetCategory.mockResolvedValue(buildCategory());

      await service.createBudgetCategory({
        userId: userAId,
        budgetId: 1,
        dto: {
          name: 'Rent',
          allocated: 500,
          spent: 0,
          budgetId: 1,
        } as any,
      });

      expect(repo.findCategotyQuery).toHaveBeenCalledTimes(1);
      const whereArg = (repo.findCategotyQuery.mock.calls[0] as any[])[0].where;
      expect(whereArg).not.toHaveProperty('user');
      expect(whereArg).toHaveProperty('budget');
      expect(whereArg.budget).toMatchObject({
        id: 1,
        user: { id: userAId },
      });
    });

    it('findCategories: where clause is scoped via budget.user (NOT a flat user filter)', async () => {
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [buildBudget({ id: 1, user: { id: userAId, ...budgetUser } })],
      });
      repo.findCategotyQuery.mockResolvedValue([]);

      await service.findCategories({
        userId: userAId,
        budgetId: 1,
        name: 'Freelance',
      });

      expect(repo.findCategotyQuery).toHaveBeenCalledTimes(1);
      const whereArg = (repo.findCategotyQuery.mock.calls[0] as any[])[0].where;
      expect(whereArg).not.toHaveProperty('user');
      expect(whereArg).toMatchObject({
        budget: { user: { id: userAId }, id: 1 },
        name: 'Freelance',
      });
    });

    it('findCategories: omitting budgetId still scopes via budget.user (cross-user filter is honoured)', async () => {
      userRepo.findById.mockResolvedValue(mockUser);
      repo.findCategotyQuery.mockResolvedValue([]);

      await service.findCategories({
        userId: userAId,
      });

      expect(repo.findCategotyQuery).toHaveBeenCalledTimes(1);
      const whereArg = (repo.findCategotyQuery.mock.calls[0] as any[])[0].where;
      expect(whereArg).not.toHaveProperty('user');
      expect(whereArg).toMatchObject({
        budget: { user: { id: userAId } },
      });
      // No `id` should be present on the `budget` clause when the caller
      // omitted budgetId.
      expect(whereArg.budget).not.toHaveProperty('id');
    });

    it('findCategories: filtering by a foreign budgetId is rejected', async () => {
      await expect(
        service.findCategories({
          userId: userAId,
          budgetId: foreignBudgetId,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('createBudgetCategory: translates DB-level unique violation (race path) to BadRequestException', async () => {
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [buildBudget({ id: 1, user: { id: userAId, ...budgetUser } })],
      });
      repo.findCategotyQuery.mockResolvedValue([]);

      const driverErr: any = new Error(
        `duplicate key value violates unique constraint "${BUDGET_CATEGORY_UNIQUE_CONSTRAINT_NAME}"`,
      );
      driverErr.code = '23505';
      driverErr.constraint = BUDGET_CATEGORY_UNIQUE_CONSTRAINT_NAME;
      const dbError = new QueryFailedError(
        'INSERT INTO "bg_public"."budget_categories" (...) VALUES (...)',
        [],
        driverErr,
      );
      (dbError as any).code = '23505';
      (dbError as any).constraint = BUDGET_CATEGORY_UNIQUE_CONSTRAINT_NAME;
      repo.createBudgetCategory.mockRejectedValue(dbError);

      const err = await service
        .createBudgetCategory({
          userId: userAId,
          budgetId: 1,
          dto: {
            name: 'Rent',
            allocated: 500,
            spent: 0,
            budgetId: 1,
          } as any,
        })
        .catch((e) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as Error).message).toMatch(/already exists for this budget/);
    });

    it('createBudgetCategory: rethrows non-unique-violation QueryFailedError untouched', async () => {
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [buildBudget({ id: 1, user: { id: userAId, ...budgetUser } })],
      });
      repo.findCategotyQuery.mockResolvedValue([]);

      const fkErr: any = new Error('foreign key violation');
      fkErr.code = '23503';
      fkErr.constraint = 'FK_some_other';
      const otherDbError = new QueryFailedError('INSERT ...', [], fkErr);
      (otherDbError as any).code = '23503';
      (otherDbError as any).constraint = 'FK_some_other';
      repo.createBudgetCategory.mockRejectedValue(otherDbError);

      await expect(
        service.createBudgetCategory({
          userId: userAId,
          budgetId: 1,
          dto: {
            name: 'Rent',
            allocated: 500,
            spent: 0,
            budgetId: 1,
          } as any,
        }),
      ).rejects.toThrow(QueryFailedError);
    });

    it('createBudgetCategory: race-translator matches the canonical constraint name constant', async () => {
      expect(BUDGET_CATEGORY_UNIQUE_CONSTRAINT_NAME).toBe(
        'UQ_budget_categories_budgetId_name',
      );
    });

    // Spec-gap guard (added in v1.4.x): the post-create recalc hook was
    // wired up because parent totals silently drifted otherwise. This
    // test pins the wiring via mock expectations — without it, a future
    // refactor could drop the recalc without breaking any spec, and the
    // parent-drift bug would re-emerge invisibly.
    it('createBudgetCategory: recalculates parent budget totalSpent after insert', async () => {
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [buildBudget({ id: 1, user: { id: userAId, ...budgetUser } })],
      });
      // findById is called TWICE in createBudgetCategory: once for the
      // initial budget-existence check (must succeed), once from inside
      // recalculateBudgetTotalSpent (the post-create read). Both calls
      // use identical args, so a positional expectation (times + last)
      // is required to lock both fire — not just the existence check.
      // buildBudget inherits mockCategoryShape.spent: 250 if its
      // categories are not overridden — do that explicitly so the sum
      // matches the asserted value below.
      repo.findById.mockResolvedValue(
        buildBudget({ id: 1, categories: [buildCategory(newCategoryShape)] }),
      );
      repo.findCategotyQuery.mockResolvedValue([]);
      repo.createBudgetCategory.mockResolvedValue(
        buildCategory({
          ...newCategoryShape,
          budget: { ...categoryBudget, id: 1 },
        }),
      );
      repo.updateBudget.mockResolvedValue({} as any);

      await service.createBudgetCategory({
        userId: userAId,
        budgetId: 1,
        dto: {
          name: 'NewCategory',
          allocated: 100,
          spent: 30,
          budgetId: 1,
        } as any,
      });

      expect(repo.createBudgetCategory).toHaveBeenCalledTimes(1);
      // The post-create recalc hook MUST fire (regression guard). Both
      // expected: existence check + recalc. Verifying `times(2)` AND
      // `lastCalledWith` ensures the recalc specifically fired — a
      // single-arg assertion would pass with only the existence check.
      expect(repo.findById).toHaveBeenCalledTimes(2);
      expect(repo.findById).toHaveBeenLastCalledWith(1, userAId);
      expect(repo.updateBudget).toHaveBeenCalledTimes(1);
      // Capture the recalc write's argument shape — locks the wiring
      // beyond "a write happened" and verifies the actual sum.
      const updatedBudget = repo.updateBudget.mock.calls[0][0];
      expect(updatedBudget.totalSpent).toBe(30); // sum of new category.spent
      expect(updatedBudget.id).toBe(1);
    });

    // Symmetric spec-gap guard for the post-delete recalc hook. Mirrors
    // the create-side tightening: positional assertions on the new
    // wires + captured arg-shape on the recalc write.
    it('deleteBudgetCategory: recalculates parent budget totalSpent after delete (when category belongs to user)', async () => {
      const categoryToDelete = buildCategory({
        id: 17,
        name: 'Medical',
        spent: 50,
        allocated: 100,
        budget: { ...categoryBudget, id: 1 },
      });
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [buildBudget({ id: 1, user: { id: userAId, ...budgetUser } })],
      });
      // getBudgetCategory must resolve to a category so the lookup
      // captures budgetId; otherwise the recalc-skip path triggers and
      // we'd be testing the wrong branch.
      repo.getBudgetCategory.mockResolvedValue(categoryToDelete);
      repo.deleteBudgetCategory.mockResolvedValue(undefined);
      // Post-delete recalc reads the (now-empty-of-17) budget + writes it.
      // categories: [] is EXPLICIT — without the override, mockBudgetShape
      // injects one entry with spent: 250 which would mask a
      // "sum-after-delete didn't fire" regression as a non-zero-but-wrong total.
      repo.findById.mockResolvedValue(buildBudget({ id: 1, categories: [] }));
      repo.updateBudget.mockResolvedValue({} as any);

      const result = await service.deleteBudgetCategory(userAId, 17);

      expect(result).toEqual({ message: 'Category deleted successfully' });
      expect(repo.getBudgetCategory).toHaveBeenCalledTimes(1);
      expect(repo.getBudgetCategory).toHaveBeenCalledWith(17, userAId);
      expect(repo.deleteBudgetCategory).toHaveBeenCalledTimes(1);
      expect(repo.deleteBudgetCategory).toHaveBeenCalledWith(17);
      // Recalc hook fired exactly once with the right (budgetId, userId).
      expect(repo.findById).toHaveBeenCalledTimes(1);
      expect(repo.findById).toHaveBeenCalledWith(1, userAId);
      expect(repo.updateBudget).toHaveBeenCalledTimes(1);
      // Capture the recalc write's argument shape — locks the wiring
      // beyond "a write happened" and verifies the sum is reset.
      const updatedBudget = repo.updateBudget.mock.calls[0][0];
      expect(updatedBudget.totalSpent).toBe(0); // categories[] after delete
      expect(updatedBudget.id).toBe(1);
    });

    it('createBudgetCategory: rethrows non-QueryFailedError untouched', async () => {
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [buildBudget({ id: 1, user: { id: userAId, ...budgetUser } })],
      });
      repo.findCategotyQuery.mockResolvedValue([]);
      repo.createBudgetCategory.mockRejectedValue(
        new Error('connection reset'),
      );

      await expect(
        service.createBudgetCategory({
          userId: userAId,
          budgetId: 1,
          dto: {
            name: 'Rent',
            allocated: 500,
            spent: 0,
            budgetId: 1,
          } as any,
        }),
      ).rejects.toThrow('connection reset');
    });
  });

  describe('single-currency budget totals', () => {
    it('sums mixed-currency entries unchanged when listing budgets', async () => {
      const mixedBudget = buildBudget({
        id: 1,
        totalSpent: 0,
        totalAllocated: 0,
        categories: [
          buildCategory({
            id: 1,
            name: 'Food',
            spent: 50,
            allocated: 50,
          }),
          {
            ...buildCategory({
              id: 2,
              name: 'Sweets',
              spent: 200000,
              allocated: 200000,
            }),
            currency: 'COP',
          },
        ],
      });
      repo.findByUser.mockResolvedValue([mixedBudget]);
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [mixedBudget],
      });

      const result = await service.getBudgets(1);

      expect(result).toHaveLength(1);
      // Switching currency does not alter the source numeric values.
      expect(result[0].totalSpent).toBe(200050);
      expect(result[0].totalAllocated).toBe(200050);
    });

    it('keeps values unchanged for a single-currency budget', async () => {
      const usdBudget = buildBudget({
        id: 1,
        categories: [
          buildCategory({
            id: 1,
            spent: 850,
            allocated: 550,
          }),
        ],
      });
      repo.findByUser.mockResolvedValue([usdBudget]);
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [usdBudget],
      });

      const result = await service.getBudgets(1);

      expect(result[0].totalSpent).toBe(850);
      expect(result[0].totalAllocated).toBe(550);
    });

    it('keeps category values unchanged even when their currency differs from the user setting', async () => {
      const copBudget = buildBudget({
        id: 1,
        categories: [
          {
            ...buildCategory({
              id: 1,
              spent: 50,
              allocated: 50,
            }),
            currency: 'COP' as SupportedCurrency,
          },
        ],
      });
      repo.findByUser.mockResolvedValue([copBudget]);
      userRepo.findById.mockResolvedValue({
        ...mockUser,
        budgets: [copBudget],
      });

      const result = await service.getBudgets(1);

      expect(result[0].totalSpent).toBe(50);
      expect(result[0].totalAllocated).toBe(50);
    });

    it('recalculates mixed-currency category totals without conversion', async () => {
      const copCategory = {
        ...buildCategory({
          id: 1,
          spent: 200000,
          allocated: 200000,
          budget: { ...categoryBudget, id: 1 },
        }),
        currency: 'COP' as SupportedCurrency,
      };
      const copBudget = buildBudget({
        id: 1,
        totalSpent: 0,
        totalAllocated: 0,
        categories: [copCategory],
      });

      // updateBudgetCategory happy-path mocks.
      repo.getBudgetCategory.mockResolvedValue(copCategory);
      userRepo.findById.mockResolvedValue(mockUser);
      repo.updateBudgetCategory.mockResolvedValue(copCategory);
      // Recalc reads the (now-COP) budget + writes the coerced totals.
      repo.findById.mockResolvedValue(copBudget);

      await service.updateBudgetCategory(1, {
        id: 1,
        name: 'Sweets',
        allocated: 200000,
        spent: 200000,
        currency: 'COP',
      } as any);

      expect(repo.updateBudget).toHaveBeenCalledTimes(1);
      const writtenBudget = repo.updateBudget.mock.calls[0][0];
      expect(writtenBudget.totalSpent).toBe(200000);
      expect(writtenBudget.totalAllocated).toBe(200000);
    });
  });
});
