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

  /**
   * Find a budget by id, scoped to the requesting user so we never leak
   * other users' budgets via numeric id guessing. Throws NotFoundException
   * if the id does not belong to the user — intentionally NOT 403 to avoid
   * leaking ownership existence (paper trail is the same as "not found").
   */
  async findById(id: number, userId: number): Promise<Budget> {
    const b = await this.repo.findOne({
      where: { id, user: { id: userId } },
      relations: ['categories', 'user'],
    });
    if (!b) throw new NotFoundException(`Budget ${id} not found`);
    return b;
  }

  async findByBudgetId(
    budgetId: number,
    userId: number,
  ): Promise<BudgetCategory[]> {
    return this.categoryRepo.find({
      where: { budget: { id: budgetId, user: { id: userId } } },
    });
  }

  /**
   * Find a budget category by id, scoped to the requesting user through
   * the category → budget → user relation. NotFoundException on miss.
   */
  async getBudgetCategory(id: number, userId: number): Promise<BudgetCategory> {
    const c = await this.categoryRepo.findOne({
      where: { id, budget: { user: { id: userId } } },
      relations: ['budget'],
    });
    if (!c) throw new NotFoundException(`Budget category ${id} not found`);
    return c;
  }

  async findCategotyQuery(query: any): Promise<BudgetCategory[]> {
    return this.categoryRepo.find(query);
  }

  /**
   * Update a budget — defence in depth: pre-fetch with the userId filter
   * so a malicious caller cannot bypass `findById(..., userId)` upstream
   * and still reach this method with the row.
   */
  async updateBudget(budget: Partial<Budget>, userId: number): Promise<Budget> {
    if (budget.id != null) {
      const owned = await this.repo.findOne({
        where: { id: budget.id, user: { id: userId } },
      });
      if (!owned) {
        throw new NotFoundException(
          `Budget ${budget.id} not found or not owned by user`,
        );
      }
    }
    return this.repo.save(budget);
  }

  /**
   * Update a budget category — defence in depth: pre-fetch with the userId
   * filter through the category → budget → user relation chain. Throw
   * NotFoundException so service-level callers don't get to bypass the
   * ownership semantics by calling save() directly with a foreign id.
   */
  async updateBudgetCategory(
    category: Partial<BudgetCategory>,
    userId: number,
  ): Promise<BudgetCategory> {
    if (category.id != null) {
      const owned = await this.categoryRepo.findOne({
        where: { id: category.id, budget: { user: { id: userId } } },
      });
      if (!owned) {
        throw new NotFoundException(
          `Budget category ${category.id} not found or not owned by user`,
        );
      }
    }
    return this.categoryRepo.save(category);
  }

  /**
   * Delete a budget category by id — ownership is validated by the
   * service layer via `categoryRepo.getBudgetCategory(id, userId)` BEFORE
   * this method is invoked, so the repo only needs to operate on the
   * local `id` column.
   *
   * The previous signature was `deleteBudgetCategory(id, userId)` and
   * the body used `categoryRepo.delete({ id, budget: { user: { id } } })`.
   * That two-level nested relation criteria is NOT translated to a JOIN
   * by TypeORM's `Repository.delete()` — it tries to match a literal
   * `budget` column on `budget_categories`, which does not exist, so
   * the driver throws `QueryFailedError`. The custom
   * `EntityNotFoundExceptionFilter` catches `EntityNotFoundError` only;
   * `QueryFailedError` falls through to Nest's default filter and
   * surfaces as a 500. User-facing symptom: `DELETE /budgets/category/:id`
   * returned 500 even when the category legitimately belonged to the
   * caller. Fixed in v1.4.x by hoisting ownership validation into the
   * service (which uses `findOne` and DOES translate the nested WHERE
   * correctly via QueryBuilder).
   */
  async deleteBudgetCategory(id: number): Promise<void> {
    await this.categoryRepo.delete({ id });
  }

  /**
   * Delete a budget scoped to the user — same silent-on-miss semantics as
   * deleteBudgetCategory. The { id, user: { id: userId } } where-clause on
   * the Repository.delete() call scopes the delete to the owning user in a
   * single statement, so we never accidentally delete another user's budget.
   */
  async deleteBudget(id: number, userId: number): Promise<void> {
    await this.repo.delete({ id, user: { id: userId } });
  }
}
