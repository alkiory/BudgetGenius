import {
  BadRequestException,
  ForbiddenException,
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
    const existingCount = await this.repo.countByUser(userId);

    const user = await this.userRepo.findById(userId);
    if (!user.isPremium && existingCount >= 3) {
      this.logger.warn(
        `User ${userId} attempted to create a 4th budget while free`,
      );
      throw new ForbiddenException(
        'Free users may only create up to 3 budgets.  Upgrade to premium to add more.',
      );
    }

    const totalSpent = dto.totalSpent ?? 0;

    if (totalSpent > dto.totalAllocated) {
      throw new BadRequestException(
        `Total spent ${totalSpent} cannot be greater than total allocated ${dto.totalAllocated}`,
      );
    }

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

    if (user.budgets.find((b) => b.name === dto.name)) {
      throw new BadRequestException(`3. Category ${dto.name} already exists`);
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

    // check spent category values are not greater than total allocated
    for (const budget of budgets) {
      if (budget.totalSpent > budget.totalAllocated) {
        throw new BadRequestException(
          `Total spent ${budget.totalSpent} cannot be greater than total allocated ${budget.totalAllocated}`,
        );
      }
    }

    // calculate total spent and total allocated
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

  async getBudget(id: number): Promise<Budget> {
    const response = await this.repo.findById(id);
    if (!response) {
      throw new NotFoundException(`Budget ${id} not found`);
    }
    return response;
  }

  async findCategories(filters: {
    userId?: number;
    budgetId?: number;
    name?: string;
  }) {
    const user = await this.userRepo.findById(filters.userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.budgets.find((b) => b.id === filters.budgetId)) {
      throw new NotFoundException(`This budget does not exist`);
    }

    const where: any = {};
    if (filters.budgetId) {
      where.budget = { id: filters.budgetId };
    }

    if (filters.name) {
      where.name = filters.name;
    }
    return this.repo.findCategotyQuery({ where });
  }

  async getBudgetCategory(id: number): Promise<BudgetCategory> {
    const response = await this.repo.getBudgetCategory(id);
    if (!response) {
      throw new NotFoundException(`Budget category ${id} not found`);
    }
    return response;
  }

  async updateBudget(userId: number, dto: UpdateBudgetDto): Promise<Budget> {
    const budget = await this.repo.findById(dto.id);
    const user = await this.userRepo.findById(userId);

    if (!budget) {
      throw new NotFoundException(`Budget ${dto.id} not found`);
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (budget.user.id !== userId) {
      throw new NotFoundException(`This budget does not exist`);
    }

    // check spent category values are not greater than total allocated
    if (
      dto.categories?.some(
        (category) => category.allocated < category.spent || category.spent < 0,
      )
    ) {
      throw new BadRequestException(
        `Total spent cannot be greater than total allocated`,
      );
    }

    if (dto.endDate < dto.startDate) {
      throw new BadRequestException(
        `End date ${dto.endDate} cannot be less than start date ${dto.startDate}`,
      );
    }

    if (budget.totalAllocated < dto.totalSpent) {
      throw new BadRequestException(
        `Total spent ${dto.totalSpent} cannot be greater than total allocated ${budget.totalAllocated}`,
      );
    }

    const updatedCategories = dto.categories?.map((category) => ({
      ...category,
      id: category.id,
      allocated: category.allocated,
      spent: category.spent,
    })) as BudgetCategory[];

    if (
      updatedCategories.some(
        (category) => category.allocated < category.spent || category.spent < 0,
      )
    ) {
      throw new BadRequestException(
        `Total spent cannot be greater than total allocated`,
      );
    }

    return this.repo.updateBudget({
      ...dto,
      categories: updatedCategories,
      updatedAt: new Date(),
    });
  }

  async updateBudgetCategory(
    userId: number,
    dto: UpdateBudgetCategoryDto,
  ): Promise<BudgetCategory> {
    const category = await this.categoryRepo.findByBudgetId(dto.id);
    const user = await this.userRepo.findById(userId);

    if (!category) {
      throw new NotFoundException(`Category ${dto.id} not found`);
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.repo.updateBudgetCategory({
      ...dto,
      updatedAt: new Date(),
    });
  }

  async deleteBudgetCategory(userId: number, id: number) {
    const category = await this.categoryRepo.getBudgetCategory(id);
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    if (!user.budgets.some((b) => b.id === category.budget.id)) {
      throw new NotFoundException(
        `This category does not belong to this user's budget`,
      );
    }

    await this.repo.deleteBudgetCategory(id);

    return { message: 'Category deleted successfully' };
  }

  async deleteBudget(userId: number, id: number): Promise<void> {
    const budget = await this.repo.findById(id);
    const user = await this.userRepo.findById(userId);

    if (!budget) {
      throw new NotFoundException(`Budget ${id} not found`);
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.budgets.find((b) => b.id === budget.id)) {
      throw new NotFoundException(`This budget does not exist`);
    }

    return this.repo.deleteBudget(id);
  }
}
