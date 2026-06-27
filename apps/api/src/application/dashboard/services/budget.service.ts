import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BudgetRepository } from '@adapters/dashboard/persistence/budget.repository';
import { Budget } from '@domain/dashboard/budget.entity';
import {
  CreateBudgetCategoryDto,
  CreateBudgetDto,
} from '../dto/create-budget.dto';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';
import {
  UpdateBudgetCategoryDto,
  UpdateBudgetDto,
} from '../dto/update-budget.dto';
import {
  BUDGET_CATEGORY_UNIQUE_CONSTRAINT_NAME,
  BudgetCategory,
} from '@domain/dashboard/budget-category.entity';
import { User } from '@domain/user/user.entity';
import { LoggingService } from '@infrastructure/log/logger.service';
import { QueryFailedError } from 'typeorm';
import { UserSettingsService } from '@application/user/user-settings.service';
import { SupportedCurrency } from '@domain/user/user-settings.entity';

@Injectable()
export class BudgetService {
  constructor(
    private readonly repo: BudgetRepository,
    private readonly categoryRepo: BudgetRepository,
    private readonly userRepo: UserRepositoryImpl,
    private readonly logger: LoggingService,
    private readonly userSettingsService: UserSettingsService,
  ) { }

  async createBudget(userId: number, dto: CreateBudgetDto): Promise<Budget> {
    const user = await this.userRepo.findById(userId);

    const totalSpent = dto.totalSpent ?? 0;

    if (user.budgets.find((b) => b.name === dto.name)) {
      throw new BadRequestException(`Budget ${dto.name} already exists`);
    }

    if (dto.endDate < dto.startDate) {
      throw new BadRequestException(
        `End date ${dto.endDate} cannot be less than start date ${dto.startDate}`,
      );
    }

    const categories = dto.categories?.map((category) => ({
      ...category,
    })) as BudgetCategory[];

    this.logger.log('budget created: ', {
      ...dto,
      totalSpent,
      user: { id: userId } as User,
      categories,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.repo.createBudget({
      ...dto,
      totalSpent,
      user: { id: userId } as User,
      categories,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async createBudgetCategory({
    userId,
    budgetId,
    dto,
  }: {
    userId: number;
    budgetId: number;
    dto: CreateBudgetCategoryDto;
  }): Promise<BudgetCategory> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.repo.findById(budgetId, userId);

    const existing = await this.repo.findCategotyQuery({
      where: {
        budget: { id: budgetId, user: { id: userId } },
        name: dto.name,
      },
    });
    if (existing.length > 0) {
      throw new BadRequestException(
        `Category "${dto.name}" already exists for this budget`,
      );
    }

    const resolvedCurrency: SupportedCurrency =
      dto.currency ?? (await this.resolveCurrencyForUser(userId));

    const newCategory = {
      ...dto,
      currency: resolvedCurrency,
      budget: { id: budgetId } as Budget,
    };

    try {
      return await this.repo.createBudgetCategory(newCategory);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as any).code === '23505' &&
        (err as any).constraint === BUDGET_CATEGORY_UNIQUE_CONSTRAINT_NAME
      ) {
        this.logger.warn(
          `[concurrent-insert] duplicate category name "${dto.name}" ` +
          `for budget ${budgetId} caught at DB layer`,
        );
        throw new BadRequestException(
          `Category "${dto.name}" already exists for this budget`,
        );
      }
      throw err;
    }
  }

  async getBudgets(userId: number): Promise<Budget[]> {
    const user = await this.userRepo.findById(userId);
    const budgets = await this.repo.findByUser(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.budgets) {
      return [];
    }

    // calculate total spent and total allocated from categories
    for (const budget of budgets) {
      let totalSpent = 0;
      let totalAllocated = 0;
      for (const category of budget.categories) {
        totalSpent += category.spent;
        totalAllocated += category.allocated;
      }
      budget.totalSpent = totalSpent;
      budget.totalAllocated = totalAllocated;
    }

    return budgets;
  }

  async getBudget(id: number, userId: number): Promise<Budget> {
    // Repo scopes by userId — throws NotFoundException on miss so we don't
    // leak whether the budget exists for another user.
    return this.repo.findById(id, userId);
  }

  async findCategories(filters: {
    userId: number;
    budgetId?: number;
    name?: string;
  }) {
    const user = await this.userRepo.findById(filters.userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (
      filters.budgetId !== undefined &&
      !user.budgets.find((b) => b.id === filters.budgetId)
    ) {
      throw new NotFoundException(`This budget does not exist`);
    }

    const where: any = { budget: { user: { id: filters.userId } } };
    if (filters.budgetId) {
      where.budget = { ...where.budget, id: filters.budgetId };
    }

    if (filters.name) {
      where.name = filters.name;
    }
    return this.repo.findCategotyQuery({ where });
  }

  async getBudgetCategory(id: number, userId: number): Promise<BudgetCategory> {
    // Repo scopes by userId through category → budget → user relation.
    return this.repo.getBudgetCategory(id, userId);
  }

  async updateBudget(userId: number, dto: UpdateBudgetDto): Promise<Budget> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }
    const existing = await this.repo.findById(dto.id, userId);
    if (!existing) {
      throw new NotFoundException(`Budget ${dto.id} not found`);
    }

    if (dto.endDate < dto.startDate) {
      throw new BadRequestException(
        `End date ${dto.endDate} cannot be less than start date ${dto.startDate}`,
      );
    }

    const updatedCategories = dto.categories?.map((category) => ({
      ...category,
      id: category.id,
      allocated: category.allocated,
      spent: category.spent,
    })) as BudgetCategory[];

    return this.repo.updateBudget(
      {
        ...dto,
        categories: updatedCategories,
        updatedAt: new Date(),
      },
      userId,
    );
  }

  async updateBudgetCategory(
    userId: number,
    dto: UpdateBudgetCategoryDto,
  ): Promise<BudgetCategory> {
    const category = await this.categoryRepo.getBudgetCategory(dto.id, userId);
    if (!category) {
      throw new NotFoundException(`Category ${dto.id} not found`);
    }

    const resolvedCurrency: SupportedCurrency =
      dto.currency ??
      (category.currency as SupportedCurrency | undefined) ??
      (await this.resolveCurrencyForUser(userId));

    const updatedCategory = await this.repo.updateBudgetCategory(
      {
        ...dto,
        currency: resolvedCurrency,
        updatedAt: new Date(),
      },
      userId,
    );

    // Recalculate the parent budget's totalSpent after category update
    await this.recalculateBudgetTotalSpent(category.budget.id, userId);

    return updatedCategory;
  }

  private async resolveCurrencyForUser(
    userId: number,
  ): Promise<SupportedCurrency> {
    try {
      const settings = await this.userSettingsService.getOrCreateSettings(userId);
      return (settings?.currency as SupportedCurrency) ?? 'USD';
    } catch (err) {
      this.logger.warn(
        `[resolveCurrencyForUser] settings lookup failed for user ${userId}; ` +
        `defaulting to USD (${(err as Error)?.message ?? err})`,
      );
      return 'USD';
    }
  }

  private async recalculateBudgetTotalSpent(
    budgetId: number,
    userId: number,
  ): Promise<void> {
    const budget = await this.repo.findById(budgetId, userId);
    const totalSpent = budget.categories.reduce(
      (sum, cat) => sum + cat.spent,
      0,
    );
    budget.totalSpent = totalSpent;
    await this.repo.updateBudget(budget, userId);
  }

  async deleteBudgetCategory(userId: number, id: number) {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Repo scopes the DELETE statement by userId → row delete is a no-op
    // for foreign ids, so no Foreign-key / 403 leakage here.
    await this.repo.deleteBudgetCategory(id, userId);

    return { message: 'Category deleted successfully' };
  }

  async deleteBudget(userId: number, id: number): Promise<void> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Repo scopes the DELETE statement by userId; same no-op semantics as
    // deleteBudgetCategory for foreign ids.
    return this.repo.deleteBudget(id, userId);
  }
}
