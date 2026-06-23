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
import { BudgetCategory } from '@domain/dashboard/budget-category.entity';
import { User } from '@domain/user/user.entity';
import { LoggingService } from '@infrastructure/log/logger.service';

@Injectable()
export class BudgetService {
  constructor(
    private readonly repo: BudgetRepository,
    private readonly categoryRepo: BudgetRepository,
    private readonly userRepo: UserRepositoryImpl,
    private readonly logger: LoggingService,
  ) {}

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

    // Direct DB ownership check (defence in depth). The earlier
    // `user.budgets.find(...)` relied on the eager-loaded `budgets`
    // array, which can go stale if the budget was deleted concurrently;
    // pointing through the repo's user-scoped findById is authoritative.
    // The repo throws NotFoundException for foreign ids so we get a
    // clean 404 instead of a generic FK violation downstream.
    await this.repo.findById(budgetId, userId);

    // DB-based uniqueness check for duplicate category names under the
    // same parent budget. The previous eager-load check was removed
    // because it raced; this query reads the actual table, so it
    // catches concurrent inserts only if a DB-level UNIQUE constraint
    // is also added — see the post-MVP cleanup task list for that
    // migration. Until then, two simultaneous POSTs from the same user
    // could create two categories with the same name; the application-
    // level check still protects against the common-path replay case.
    const existing = await this.repo.findCategotyQuery({
      where: {
        budget: { id: budgetId },
        user: { id: userId },
        name: dto.name,
      },
    });
    if (existing.length > 0) {
      throw new BadRequestException(
        `Category "${dto.name}" already exists for this budget`,
      );
    }

    const newCategory = {
      ...dto,
      budget: { id: budgetId } as Budget,
    };

    return this.repo.createBudgetCategory(newCategory);
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

    const where: any = { user: { id: filters.userId } };
    if (filters.budgetId) {
      where.budget = { id: filters.budgetId };
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

    // Repo pre-filters and throws NotFoundException if the budget is not
    // owned by the requesting user; this is the primary ownership check
    // (defence in depth: see budget.repository.updateBudget).
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
    // Repo pre-filters via category → budget → user; throws NotFoundException
    // if the category is not owned by the requesting user.
    const category = await this.categoryRepo.getBudgetCategory(dto.id, userId);
    if (!category) {
      throw new NotFoundException(`Category ${dto.id} not found`);
    }

    const updatedCategory = await this.repo.updateBudgetCategory(
      {
        ...dto,
        updatedAt: new Date(),
      },
      userId,
    );

    // Recalculate the parent budget's totalSpent after category update
    await this.recalculateBudgetTotalSpent(category.budget.id, userId);

    return updatedCategory;
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
