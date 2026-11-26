/**
 * Savings goals read their progress from the ledger: `manualSpent` baseline
 * plus every deposit transaction linked to the category. These tests lock in
 * the consequences — a deleted deposit lowers the goal, an edited amount
 * moves it, and a plain edit keeps the link instead of silently unlinking.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BudgetService } from '@application/dashboard/services/budget.service';
import { TransactionService } from '@application/dashboard/services/transaction.service';

type RepoMock = {
  findByUser: jest.Mock;
  findById: jest.Mock;
  findCategotyQuery: jest.Mock;
  sumExpenseAmountsByBudget: jest.Mock;
  sumLinkedSavingsByCategory: jest.Mock;
};

const makeBudgetService = () => {
  const repo: RepoMock = {
    findByUser: jest.fn(),
    findById: jest.fn(),
    findCategotyQuery: jest.fn(),
    sumExpenseAmountsByBudget: jest.fn().mockResolvedValue([]),
    sumLinkedSavingsByCategory: jest.fn().mockResolvedValue([]),
  };
  const userRepo = { findById: jest.fn() };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const service = new BudgetService(
    repo as any,
    repo as any,
    userRepo as any,
    logger as any,
    dataSource as any,
  );
  return { service, repo, userRepo, dataSource };
};

const savingsBudget = () =>
  ({
    id: 36,
    name: 'Fondo de emergencia',
    type: 'savings',
    startDate: '2026-11-26',
    endDate: '2027-11-26',
    totalAllocated: 684,
    totalSpent: 300,
    categories: [
      {
        id: 67,
        name: 'Fondo de emergencia',
        allocated: 684,
        manualSpent: 300,
        spent: 300,
        budget: { id: 36 },
      },
    ],
  }) as any;

describe('Savings goal progress follows its transactions', () => {
  describe('BudgetService.getBudgets', () => {
    it('adds linked deposits on top of the manual baseline', async () => {
      const { service, repo, userRepo } = makeBudgetService();
      const budget = savingsBudget();
      repo.findByUser.mockResolvedValue([budget]);
      userRepo.findById.mockResolvedValue({ id: 1, budgets: [budget] });
      repo.sumLinkedSavingsByCategory.mockResolvedValue([
        { categoryId: 67, total: 40 },
      ]);

      const [result] = await service.getBudgets(1);

      expect(result.categories[0]).toMatchObject({
        manualSpent: 300,
        transactionSpent: 40,
        spent: 340,
      });
      expect(result.totalSpent).toBe(340);
    });

    it('drops the goal when the linked deposit no longer exists', async () => {
      const { service, repo, userRepo } = makeBudgetService();
      const budget = savingsBudget();
      repo.findByUser.mockResolvedValue([budget]);
      userRepo.findById.mockResolvedValue({ id: 1, budgets: [budget] });
      // Before deleting the row the linked total was 40; after the delete
      // the aggregate is 0 and no extra write touches the category.
      repo.sumLinkedSavingsByCategory.mockResolvedValue([]);

      const [result] = await service.getBudgets(1);

      expect(result.categories[0].spent).toBe(300);
      expect(result.totalSpent).toBe(300);
    });

    it('follows an edited deposit amount (15 -> 20)', async () => {
      const { service, repo, userRepo } = makeBudgetService();
      const budget = savingsBudget();
      repo.findByUser.mockResolvedValue([budget]);
      userRepo.findById.mockResolvedValue({ id: 1, budgets: [budget] });
      repo.sumLinkedSavingsByCategory.mockResolvedValue([
        { categoryId: 67, total: 20 },
      ]);

      const [result] = await service.getBudgets(1);

      expect(result.categories[0].spent).toBe(320);
    });

    it('does not let a spending category with the same name hijack a savings goal', async () => {
      const { service, repo, userRepo } = makeBudgetService();
      const budget = savingsBudget();
      repo.findByUser.mockResolvedValue([budget]);
      userRepo.findById.mockResolvedValue({ id: 1, budgets: [budget] });
      repo.sumExpenseAmountsByBudget.mockResolvedValue([
        { budgetId: 36, category: 'fondo de emergencia', total: 999 },
      ]);
      repo.sumLinkedSavingsByCategory.mockResolvedValue([]);

      const [result] = await service.getBudgets(1);

      expect(result.categories[0].spent).toBe(300);
    });

    it('keeps spending budgets using linked spending rows only', async () => {
      const { service, repo, userRepo } = makeBudgetService();
      const budget = {
        id: 10,
        name: 'Casa',
        type: 'spending',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        totalAllocated: 500,
        totalSpent: 0,
        categories: [
          {
            id: 60,
            name: 'Utilities',
            allocated: 500,
            manualSpent: 0,
            spent: 0,
            budget: { id: 10 },
          },
        ],
      } as any;
      repo.findByUser.mockResolvedValue([budget]);
      userRepo.findById.mockResolvedValue({ id: 1, budgets: [budget] });
      repo.sumExpenseAmountsByBudget.mockResolvedValue([
        { budgetId: 10, category: 'utilities', total: 50 },
      ]);
      repo.sumLinkedSavingsByCategory.mockResolvedValue([
        { categoryId: 60, total: 999 },
      ]);

      const [result] = await service.getBudgets(1);

      expect(result.categories[0]).toMatchObject({
        manualSpent: 0,
        transactionSpent: 50,
        spent: 50,
      });
    });
  });

  describe('BudgetService.contributeToSavingsGoal', () => {
    const buildManager = (options: {
      category: any;
      deposited: string;
      categories: any[];
    }) => {
      const categoryQuery = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(options.category),
      };
      const depositedQuery = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: options.deposited }),
      };
      const sumsQuery = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(
          options.categories.map((category) => ({
            categoryId: String(category.id),
            total: options.deposited,
          })),
        ),
      };
      const manager = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(categoryQuery)
          .mockReturnValueOnce(depositedQuery)
          .mockReturnValueOnce(sumsQuery),
        create: jest.fn((_entity, data) => ({ ...data, id: 9001 })),
        save: jest.fn(async (_entity, value) => value),
        getRepository: jest.fn(() => ({
          find: jest.fn().mockResolvedValue(options.categories),
        })),
      };
      return manager;
    };

    const category = (): any => ({
      id: 67,
      name: 'Fondo de emergencia',
      allocated: 684,
      manualSpent: 300,
      spent: 300,
      budget: {
        id: 36,
        name: 'Fondo de emergencia',
        type: 'savings',
        allocated: 684,
      },
    });

    it('writes the dated transaction without bumping the manual baseline', async () => {
      const { service, dataSource } = makeBudgetService();
      const target = category();
      const manager = buildManager({
        category: target,
        deposited: '40',
        categories: [target],
      });
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      const result = await service.contributeToSavingsGoal(1, {
        categoryId: 67,
        amount: 40,
        date: '2026-11-05',
        description: 'Aporte',
      });

      expect(result.transaction).toMatchObject({
        description: 'Aporte',
        category: 'Savings',
        amount: -40,
        budgetCategoryId: 67,
        date: new Date('2026-11-05T00:00:00.000Z'),
      });
      expect(target.manualSpent).toBe(300);
      expect(target.transactionSpent).toBe(40);
      expect(target.spent).toBe(340);
      expect(result.category.spent).toBe(340);
      expect(result.budget.totalSpent).toBe(340);
    });

    it('rejects a deposit into a spending budget', async () => {
      const { service, dataSource } = makeBudgetService();
      const target = category();
      target.budget.type = 'spending';
      const manager = buildManager({
        category: target,
        deposited: '40',
        categories: [target],
      });
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      await expect(
        service.contributeToSavingsGoal(1, {
          categoryId: 60,
          amount: 40,
          date: '2026-11-05',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a category that does not belong to the caller', async () => {
      const { service, dataSource } = makeBudgetService();
      const manager = buildManager({
        category: null,
        deposited: '0',
        categories: [],
      });
      dataSource.transaction.mockImplementation(async (callback) =>
        callback(manager),
      );

      await expect(
        service.contributeToSavingsGoal(2, {
          categoryId: 67,
          amount: 40,
          date: '2026-11-05',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects non-positive amounts and malformed dates before writing', async () => {
      const { service, dataSource } = makeBudgetService();

      await expect(
        service.contributeToSavingsGoal(1, {
          categoryId: 67,
          amount: 0,
          date: '2026-11-05',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.contributeToSavingsGoal(1, {
          categoryId: 67,
          amount: 10,
          date: 'not-a-day',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('TransactionService.updateTransaction', () => {
    const makeService = (existing: any) => {
      const txRepo = {
        findByUser: jest.fn().mockResolvedValue({ id: 1 }),
        findOne: jest.fn().mockResolvedValue(existing),
        findOwnedSavingsCategoryId: jest.fn().mockResolvedValue(67),
        findBestBudgetCategoryId: jest.fn().mockResolvedValue(60),
        update: jest.fn().mockResolvedValue({ id: existing.id }),
      };
      const userRepo = { findById: jest.fn() };
      const service = new TransactionService(txRepo as any, userRepo as any);
      return { service, txRepo };
    };

    const deposit = () => ({
      id: 99,
      date: new Date('2026-11-05'),
      description: 'Aporte',
      category: 'Savings',
      amount: -15,
      budgetCategoryId: 67,
    });

    it('keeps the savings link on a plain edit and updates the amount', async () => {
      const { service, txRepo } = makeService(deposit());

      await service.updateTransaction(1, {
        id: 99,
        date: new Date('2026-11-05'),
        description: 'Aporte corregido',
        category: 'Savings',
        amount: -20,
      });

      expect(txRepo.findOwnedSavingsCategoryId).toHaveBeenCalledWith(67, 1);
      expect(txRepo.findBestBudgetCategoryId).not.toHaveBeenCalled();
      expect(txRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ budgetCategoryId: 67, amount: -20 }),
        1,
      );
    });

    it('unlinks a deposit edited into an income', async () => {
      const { service, txRepo } = makeService(deposit());

      await service.updateTransaction(1, {
        id: 99,
        date: new Date('2026-11-05'),
        description: 'Aporte',
        category: 'Savings',
        amount: 15,
      });

      expect(txRepo.findOwnedSavingsCategoryId).not.toHaveBeenCalled();
      expect(txRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ budgetCategoryId: null }),
        1,
      );
    });

    it('re-resolves when the category changes', async () => {
      const { service, txRepo } = makeService(deposit());

      await service.updateTransaction(1, {
        id: 99,
        date: new Date('2026-11-05'),
        description: 'Aporte',
        category: 'Food',
        amount: -15,
      });

      expect(txRepo.findOwnedSavingsCategoryId).not.toHaveBeenCalled();
      expect(txRepo.findBestBudgetCategoryId).toHaveBeenCalled();
      expect(txRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ budgetCategoryId: 60 }),
        1,
      );
    });
  });
});
