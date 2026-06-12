import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget } from '@domain/dashboard/budget.entity';
import { BudgetCategory } from '@domain/dashboard/budget-category.entity';

@Injectable()
export class BudgetRepository {
  constructor(
    @InjectRepository(Budget)
    private readonly repo: Repository<Budget>,
    @InjectRepository(BudgetCategory)
    private readonly categoryRepo: Repository<BudgetCategory>,
  ) {}

  async countByUser(userId: number): Promise<number> {
    return this.repo.count({ where: { user: { id: userId } } });
  }

  async createBudget(budget: Omit<Budget, 'id'>): Promise<Budget> {
    const b = this.repo.create(budget);
    return this.repo.save(b);
  }

  async createBudgetCategory(
    category: Partial<BudgetCategory>,
  ): Promise<BudgetCategory> {
    const cat = this.categoryRepo.create(category);
    return this.categoryRepo.save(cat);
  }

  async findByUser(userId: number): Promise<Budget[]> {
    return this.repo.find({
      where: { user: { id: userId } },
      relations: ['categories'],
    });
  }

  async findById(id: number): Promise<Budget> {
    const b = await this.repo.findOne({
      where: { id },
      relations: ['categories', 'user'],
    });
    if (!b) throw new NotFoundException(`Budget ${id} not found`);
    return b;
  }

  async findByBudgetId(budgetId: number): Promise<BudgetCategory[]> {
    return this.categoryRepo.find({
      where: { budget: { id: budgetId } },
    });
  }

  async getBudgetCategory(id: number): Promise<BudgetCategory> {
    const c = await this.categoryRepo.findOne({
      where: { id },
      relations: ['budget'],
    });
    if (!c) throw new NotFoundException(`Budget category ${id} not found`);
    return c;
  }

  async findCategotyQuery(query: any): Promise<BudgetCategory[]> {
    return this.categoryRepo.find(query);
  }

  async updateBudget(budget: Partial<Budget>): Promise<Budget> {
    return this.repo.save(budget);
  }

  async updateBudgetCategory(category: Partial<BudgetCategory>): Promise<any> {
    const c = await this.categoryRepo.findOne({
      where: { id: category.id },
      relations: ['budget'],
    });
    if (!c)
      throw new NotFoundException(`Budget category ${category.id} not found`);

    return this.categoryRepo.save(category);
  }

  async deleteBudgetCategory(id: number): Promise<void> {
    await this.categoryRepo.delete(id);
  }

  async deleteBudget(id: number): Promise<void> {
    const budget = await this.repo.findOne({
      where: { id },
      relations: ['categories'],
    });
    if (budget) {
      await this.repo.delete(id);
    }
  }
}
