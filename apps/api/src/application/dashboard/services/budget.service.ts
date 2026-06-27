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
import { CurrencyService } from '@infrastructure/currency/currency.service';
import { ConvertCurrencyDto } from '@infrastructure/currency/dto/convert.dto';

// Runtime members of the SupportedCurrency string-union. Used by
// `resolveCategoryCurrency` (Phase 2 polish) to defend against malformed
// DB values that bypass the TypeORM enum check.
const SUPPORTED_CURRENCIES: readonly SupportedCurrency[] = [
  'USD',
  'EUR',
  'COP',
];

@Injectable()
export class BudgetService {
  constructor(
    private readonly repo: BudgetRepository,
    private readonly categoryRepo: BudgetRepository,
    private readonly userRepo: UserRepositoryImpl,
    private readonly logger: LoggingService,
    private readonly userSettingsService: UserSettingsService,
    private readonly currencyService: CurrencyService,
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
      const created = await this.repo.createBudgetCategory(newCategory);
      // Spec-gap fix (was inconsistent with the update path which already
      // recalculates the parent budget's totalSpent via
      // `recalculateBudgetTotalSpent` after each edit). Post-create
      // recalc keeps `Budget.totalSpent` / `.totalAllocated` in sync
      // without waiting for the next category update. Best-effort: a
      // transient recalc failure doesn't bubble up to the caller because
      // the category row IS already inserted. The helper itself is
      // defensively null-tolerant (see audit note inside recalc).
      try {
        await this.recalculateBudgetTotalSpent(budgetId, userId);
      } catch (recalcErr) {
        this.logger.warn(
          `[budget-currency-coercion] post-create recalculation failed ` +
            `for budget=${budgetId} after category insert: ` +
            `${(recalcErr as Error)?.message ?? recalcErr}`,
        );
      }
      return created;
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

    // AUDIT (rpi/budget-currency-coercion): on-the-fly FX-coerced sum,
    // never persisted (the Budget entity's column is now vestigial — see
    // research.md §"Dead column signal"). The list endpoint computes
    // fresh math every request, eliminating rate-locking concerns. For
    // a single-currency user (canonicalCurrency === all cat.currency),
    // every coerceToCanonical is the identity fast-path and adds no
    // Redis traffic. canonicalCurrency resolved ONCE per request outside
    // the per-budget loop — same value applies to all budgets the user
    // owns. Inner coercion delegates to coerceCategoryTotals (Phase 2
    // polish DRY), collapsing the per-category body to a single line.
    const canonicalCurrency = await this.resolveCurrencyForUser(userId);
    for (const budget of budgets) {
      let totalSpent = 0;
      let totalAllocated = 0;
      for (const category of budget.categories) {
        const { spent, allocated } = await this.coerceCategoryTotals({
          cat: category,
          canonicalCurrency,
          caller: 'getBudgets',
        });
        totalSpent += spent;
        totalAllocated += allocated;
      }
      budget.totalSpent = totalSpent;
      budget.totalAllocated = totalAllocated;
    }

    // FIX SHIPPED (rpi/budget-currency-coercion, docs/changelog.md [v1.4.1]):
    // the stale AUDIT-TODO block above this comment was the original 2026-06
    // audit noting that this loop produced garbage for mixed-currency budgets.
    // The fix landed via `coerceCategoryTotals` (line above) — every
    // category.spent / .allocated is now FX-coerced into canonicalCurrency
    // before `+=`. The persisted `Budget.totalSpent` / `.totalAllocated`
    // columns remain vestigial and are NOT recomputed on read for
    // `getBudget(id)` (single-budget fetch); that's an isolated follow-up.

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
      const settings = await this.userSettingsService.getOrCreateSettings(
        userId,
      );
      return (settings?.currency as SupportedCurrency) ?? 'USD';
    } catch (err) {
      this.logger.warn(
        `[resolveCurrencyForUser] settings lookup failed for user ${userId}; ` +
          `defaulting to USD (${(err as Error)?.message ?? err})`,
      );
      return 'USD';
    }
  }

  // AUDIT (rpi/budget-currency-coercion): batched per-category coercion.
  // Reduces both `getBudgets` (the in-memory read path) and
  // `recalculateBudgetTotalSpent` (the persisted write path) to a single
  // for-loop body of four lines. Internally: resolves category currency
  // (defending against malformed DB values via resolveCategoryCurrency)
  // then awaits two parallel coerceToCanonical calls (one per field) via
  // Promise.all. Returns Coerced totals in the canonical currency,
  // preserving integer / float precision through CurrencyService.applyRates.
  // Plan: rpi/budget-currency-coercion/plan.md Phase 2 polish (DRY).
  private async coerceCategoryTotals(args: {
    cat: BudgetCategory;
    canonicalCurrency: SupportedCurrency;
    caller: string;
  }): Promise<{ spent: number; allocated: number }> {
    const { cat, canonicalCurrency, caller } = args;
    const catCurrency = this.resolveCategoryCurrency(cat, canonicalCurrency);
    const [spent, allocated] = await Promise.all([
      this.coerceToCanonical({
        amount: cat.spent,
        fromCurrency: catCurrency,
        targetCurrency: canonicalCurrency,
        caller,
      }),
      this.coerceToCanonical({
        amount: cat.allocated,
        fromCurrency: catCurrency,
        targetCurrency: canonicalCurrency,
        caller,
      }),
    ]);
    return { spent, allocated };
  }

  // AUDIT (rpi/budget-currency-coercion): sync helper. Resolves a
  // category's effective currency, defending against malformed DB values
  // (via the SUPPORTED_CURRENCIES runtime check) and falling back to the
  // canonical currency if the row's column is null/undefined or holds an
  // out-of-enum value. Plans: rpi/budget-currency-coercion/plan.md Phase
  // 2 polish.
  private resolveCategoryCurrency(
    cat: BudgetCategory | undefined,
    fallbackCurrency: SupportedCurrency,
  ): SupportedCurrency {
    const raw = cat?.currency;
    if (
      typeof raw === 'string' &&
      (SUPPORTED_CURRENCIES as readonly string[]).includes(raw)
    ) {
      return raw as SupportedCurrency;
    }
    return fallbackCurrency;
  }

  // AUDIT (rpi/budget-currency-coercion): FX coercion helper. Identity
  // fast-path skips CurrencyService entirely when from === target
  // (single-currency case is zero-cost). On upstream failure, returns
  // amount unchanged + structured warn log with caller context. Object-
  // param signature matches the findCategories(filters:{...}) pattern
  // in this file. Plan: rpi/budget-currency-coercion/plan.md Phase 1.
  private async coerceToCanonical(args: {
    amount: number;
    fromCurrency: SupportedCurrency;
    targetCurrency: SupportedCurrency;
    caller: string;
  }): Promise<number> {
    const { amount, fromCurrency, targetCurrency, caller } = args;
    if (fromCurrency === targetCurrency) return amount;
    try {
      const res = await this.currencyService.convert({
        fromCurrency,
        toCurrency: targetCurrency,
        amount,
      } as ConvertCurrencyDto);
      return res.convertedAmount;
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      this.logger.warn(
        `[budget-currency-coerce] identity fallback (caller=${caller} ` +
          `from=${fromCurrency} to=${targetCurrency} amount=${amount}): ${msg}`,
      );
      return amount;
    }
  }

  private async recalculateBudgetTotalSpent(
    budgetId: number,
    userId: number,
  ): Promise<void> {
    const budget = await this.repo.findById(budgetId, userId);
    // Defensive null-guard: the previously-strict contract threw on
    // `budget undefined` (crashing the parent operation). Now that the
    // post-create and post-delete wiring invokes this helper via
    // best-effort try/catch, the failure mode is "soft skip" instead of
    // a thrown error. Without this guard, the recent spec mocks for
    // create/delete happy paths (which intentionally do not stub
    // findById for the recalc step) would TypeError. Existing
    // updateBudgetCategory tests already stub findById explicitly, so
    // they're unaffected.
    if (!budget) {
      this.logger.warn(
        `[recalc-budget-missing] budget=${budgetId} not found during recalc ` +
          `— skipping. Production-context cause: the parent budget was ` +
          `deleted concurrently, so the recalculation has no authoritative ` +
          `row to recompute totals for. Test-context cause: the spec is ` +
          `missing a repo.findById stub for the budget — check the test ` +
          `before shipping a fix that requires the recalc hook.`,
      );
      return;
    }
    // FX-coerce every category.spent / .allocated to the user's canonical
    // currency (user_settings.currency via resolveCurrencyForUser, falls
    // back to 'USD'). The identity fast-path in coerceToCanonical skips the
    // CurrencyService round-trip entirely for the common single-currency
    // case — this loop costs zero Redis traffic when canonicalCurrency
    // equals every cat.currency. Promise.all reduces the per-category cost
    // from 2N sequential awaits (one per field) to N parallel awaits for
    // mixed-currency users.
    let totalSpent = 0;
    let totalAllocated = 0;
    const canonicalCurrency = await this.resolveCurrencyForUser(userId);
    for (const cat of budget.categories) {
      const { spent, allocated } = await this.coerceCategoryTotals({
        cat,
        canonicalCurrency,
        caller: 'recalculateBudgetTotalSpent',
      });
      totalSpent += spent;
      totalAllocated += allocated;
    }
    budget.totalSpent = totalSpent;
    budget.totalAllocated = totalAllocated;
    await this.repo.updateBudget(budget, userId);

    // FIX SHIPPED (rpi/budget-currency-coercion, docs/changelog.md [v1.4.1]):
    // the stale AUDIT-TODO block above was the original 2026-06 audit
    // noting that this persisted reduction writes mixed-currency nonsense
    // into the DB column. The fix landed via `coerceCategoryTotals` (call
    // above the persist) — every category.spent / .allocated is now
    // FX-coerced into canonicalCurrency before `+=` and BEFORE the trailing
    // `updateBudget` persists the sums. The persisted column is still
    // authoritative for `getBudget(id)` until that endpoint is migrated to
    // in-memory recompute too.
  }

  async deleteBudgetCategory(userId: number, id: number) {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Spec-gap fix: pre-delete lookup captures the parent budgetId so
    // we can hook the recalculation symmetric to the create path. The
    // helper recalculateBudgetTotalSpent takes (budgetId, userId), but
    // delete only receives the category id. Without this lookup, parent
    // totals silently drifted until the next category update chained.
    // The lookup also doubles as a "did this category even exist for
    // this user" check; the repo's scoped delete is a no-op for
    // foreign / missing ids, so we mirror that behaviour and skip the
    // wasted recalc when there's no parent to recompute.
    //
    // Latency cost: one indexed PK read per delete (the category→budget
    // join is PK-indexed on both sides). Acceptable because the
    // subsequent DELETE and the parent-budget UPDATE dominate the
    // write-side latency. Keeping the lookup is mandatory to preserve
    // recalc coverage on the foreign-id silent-no-op path \u2014 do not
    // "optimize" this away without first considering that the bug it
    // guards against (parent totals drifting) compounds silently across
    // every delete in the session.
    const category = await this.categoryRepo.getBudgetCategory(id, userId);
    const budgetId = category?.budget?.id;

    // Repo scopes the DELETE statement by userId → row delete is a no-op
    // for foreign ids, so no Foreign-key / 403 leakage here.
    await this.repo.deleteBudgetCategory(id);

    // Best-effort recalc — same pattern as the create hook above. A
    // transient recalc failure doesn't fool the caller into believing
    // the delete failed (the category row IS already gone).
    if (budgetId !== undefined) {
      try {
        await this.recalculateBudgetTotalSpent(budgetId, userId);
      } catch (recalcErr) {
        this.logger.warn(
          `[budget-currency-coercion] post-delete recalculation failed ` +
            `for budget=${budgetId} after category delete: ` +
            `${(recalcErr as Error)?.message ?? recalcErr}`,
        );
      }
    }

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
