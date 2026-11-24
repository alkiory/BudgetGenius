import { NotFoundException } from '@nestjs/common';
import { TransactionService } from '@application/dashboard/services/transaction.service';

/**
 * D2.2 — the attribution decided at write time is the contract these tests
 * pin down: incomes never link, ambiguity stays NULL, explicit ids must be
 * owned, and edits re-resolve instead of keeping a stale link.
 */
const makeTransactionRepo = () => ({
  findByUser: jest.fn().mockResolvedValue({ id: 1, transactions: [] }),
  create: jest
    .fn()
    .mockImplementation(async (transaction) => ({ id: 99, ...transaction })),
  createMany: jest.fn().mockResolvedValue(undefined),
  linkUnambiguousBudgetCategories: jest.fn().mockResolvedValue(0),
  findUniqueBudgetCategoryId: jest.fn().mockResolvedValue(null),
  findOwnedBudgetCategoryId: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockImplementation(async (transaction) => transaction),
});

const makeUserRepo = () => ({
  findById: jest.fn().mockResolvedValue({ id: 1 }),
});

const expenseDto = {
  date: '2026-11-10T00:00:00.000Z',
  description: 'Cena',
  category: 'Restaurantes',
  amount: -25.5,
};

describe('TransactionService — D2.2 attribution', () => {
  let transactionRepo: ReturnType<typeof makeTransactionRepo>;
  let service: TransactionService;

  beforeEach(() => {
    transactionRepo = makeTransactionRepo();
    service = new TransactionService(
      transactionRepo as never,
      makeUserRepo() as never,
    );
  });

  it('links an expense when exactly one spending category matches', async () => {
    transactionRepo.findUniqueBudgetCategoryId.mockResolvedValue(5);

    await service.createTransaction(1, expenseDto as never);

    expect(transactionRepo.findUniqueBudgetCategoryId).toHaveBeenCalledWith({
      userId: 1,
      day: '2026-11-10',
      category: 'Restaurantes',
    });
    expect(transactionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ budgetCategoryId: 5, amount: -25.5 }),
    );
  });

  it('leaves an expense unlinked when the match is ambiguous or absent', async () => {
    transactionRepo.findUniqueBudgetCategoryId.mockResolvedValue(null);

    await service.createTransaction(1, expenseDto as never);

    expect(transactionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ budgetCategoryId: null }),
    );
  });

  it('never links income, even if the client sends a category id', async () => {
    await service.createTransaction(1, {
      ...expenseDto,
      amount: 1500,
      budgetCategoryId: 5,
    } as never);

    expect(transactionRepo.findOwnedBudgetCategoryId).not.toHaveBeenCalled();
    expect(transactionRepo.findUniqueBudgetCategoryId).not.toHaveBeenCalled();
    expect(transactionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ budgetCategoryId: null, amount: 1500 }),
    );
  });

  it('accepts an explicit category owned by the caller without guessing', async () => {
    transactionRepo.findOwnedBudgetCategoryId.mockResolvedValue(7);

    await service.createTransaction(1, {
      ...expenseDto,
      budgetCategoryId: 7,
    } as never);

    expect(transactionRepo.findOwnedBudgetCategoryId).toHaveBeenCalledWith(
      7,
      1,
    );
    expect(transactionRepo.findUniqueBudgetCategoryId).not.toHaveBeenCalled();
    expect(transactionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ budgetCategoryId: 7 }),
    );
  });

  it('rejects an explicit category that belongs to another user', async () => {
    transactionRepo.findOwnedBudgetCategoryId.mockResolvedValue(null);

    await expect(
      service.createTransaction(1, {
        ...expenseDto,
        budgetCategoryId: 7,
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transactionRepo.create).not.toHaveBeenCalled();
  });

  it('re-resolves the link when an expense is edited', async () => {
    transactionRepo.findUniqueBudgetCategoryId.mockResolvedValue(4);

    await service.updateTransaction(1, {
      id: 3,
      ...expenseDto,
      amount: -10,
    } as never);

    expect(transactionRepo.findUniqueBudgetCategoryId).toHaveBeenCalledWith({
      userId: 1,
      day: '2026-11-10',
      category: 'Restaurantes',
    });
    expect(transactionRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 3, budgetCategoryId: 4 }),
      1,
    );
  });

  it('clears the link when an expense becomes income', async () => {
    await service.updateTransaction(1, {
      id: 3,
      ...expenseDto,
      amount: 99,
    } as never);

    expect(transactionRepo.findUniqueBudgetCategoryId).not.toHaveBeenCalled();
    expect(transactionRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ budgetCategoryId: null }),
      1,
    );
  });

  it('links imported rows with one set-based pass', async () => {
    const result = await service.importTransactions(1, [
      {
        date: '2026-11-10',
        description: 'Cena',
        category: 'Restaurantes',
        amount: -12,
      },
    ] as never);

    expect(transactionRepo.createMany).toHaveBeenCalledTimes(1);
    expect(
      transactionRepo.linkUnambiguousBudgetCategories,
    ).toHaveBeenCalledWith(1);
    expect(result).toEqual({ created: 1 });
  });
});
