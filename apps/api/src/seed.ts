/**
 * Development seed — realistic demo data for end-to-end testing.
 *
 * Creates (or resets) a single test account with:
 * - ~3 months of income/expense transactions spread across the categories
 *   the dashboard and reports aggregate,
 * - a "Monthly Budget" spending budget (limit €2,000) whose progress comes
 *   from those transactions (spending is always computed by the API, never
 *   stored by the seed),
 * - a "Vacation Fund" savings budget (goal €1,000) with a manual deposit so
 *   the savings progress bar is meaningful.
 *
 * Idempotent by design: if the user already exists, its transactions and
 * budgets are deleted (budget categories cascade) and re-created in one
 * transaction. Re-running never duplicates rows or throws FK/unique errors.
 *
 * Run with `pnpm seed` (from `apps/api`) or `pnpm --filter api seed`.
 */
import { AppDataSource } from './data-source';
import { User } from '@domain/user/user.entity';
import {
  SupportedCurrency,
  UserSettings,
} from '@domain/user/user-settings.entity';
import { Transaction } from '@domain/dashboard/transaction.entity';
import { Budget } from '@domain/dashboard/budget.entity';

const SEED_USER = {
  name: 'Admin',
  surname: 'BudgetGenius',
  email: 'admin@budgetgenius.com',
  password: 'password123',
} as const;

const CURRENCY: SupportedCurrency = 'EUR';

/** Rolling window covered by the spending budget (and the newest transactions). */
const BUDGET_WINDOW_DAYS = 30;

const SAVED_AMOUNT = 650;
const SAVINGS_GOAL = 1000;

interface SeedTransaction {
  /** Offset in days from today, so the data always stays "recent". */
  daysAgo: number;
  description: string;
  category: string;
  /** Positive = income, negative = expense (matches the app convention). */
  amount: number;
}

/**
 * Nine months would be noise: three monthly cycles are enough for the
 * dashboard charts, and the newest cycle (offsets 0-28) falls inside the
 * spending budget window so every progress bar has non-zero data.
 */
const TRANSACTIONS: SeedTransaction[] = [
  // ── Current cycle (inside the budget window) ──────────────────────────
  {
    daysAgo: 28,
    description: 'Nómina mensual',
    category: 'Salary',
    amount: 3200,
  },
  {
    daysAgo: 27,
    description: 'Alquiler del piso',
    category: 'Rent',
    amount: -850,
  },
  {
    daysAgo: 26,
    description: 'Compra semanal Mercadona',
    category: 'Groceries',
    amount: -165,
  },
  {
    daysAgo: 24,
    description: 'Gasolina',
    category: 'Transportation',
    amount: -140,
  },
  {
    daysAgo: 22,
    description: 'Cena con amigos',
    category: 'Food',
    amount: -58,
  },
  {
    daysAgo: 20,
    description: 'Factura de la luz',
    category: 'Utilities',
    amount: -92,
  },
  {
    daysAgo: 18,
    description: 'Entradas de cine',
    category: 'Entertainment',
    amount: -45,
  },
  {
    daysAgo: 16,
    description: 'Compra Lidl',
    category: 'Groceries',
    amount: -95,
  },
  {
    daysAgo: 15,
    description: 'Proyecto freelance',
    category: 'Freelance',
    amount: 450,
  },
  {
    daysAgo: 14,
    description: 'Café con amigos',
    category: 'Dining',
    amount: -38,
  },
  {
    daysAgo: 12,
    description: 'Abono transporte',
    category: 'Transportation',
    amount: -62,
  },
  { daysAgo: 10, description: 'Menú del día', category: 'Food', amount: -42 },
  {
    daysAgo: 8,
    description: 'Ropa de temporada',
    category: 'Shopping',
    amount: -74,
  },
  { daysAgo: 6, description: 'Farmacia', category: 'Medical', amount: -55 },
  {
    daysAgo: 4,
    description: 'Compra Carrefour',
    category: 'Groceries',
    amount: -110,
  },
  {
    daysAgo: 2,
    description: 'Pizza a domicilio',
    category: 'Food',
    amount: -36,
  },
  {
    daysAgo: 0,
    description: 'Brunch del domingo',
    category: 'Dining',
    amount: -28,
  },

  // ── Previous cycle (charts / history only) ────────────────────────────
  {
    daysAgo: 58,
    description: 'Nómina mensual',
    category: 'Salary',
    amount: 3200,
  },
  {
    daysAgo: 56,
    description: 'Alquiler del piso',
    category: 'Rent',
    amount: -850,
  },
  {
    daysAgo: 54,
    description: 'Compra semanal Mercadona',
    category: 'Groceries',
    amount: -155,
  },
  {
    daysAgo: 50,
    description: 'Gasolina',
    category: 'Transportation',
    amount: -130,
  },
  { daysAgo: 46, description: 'Cena de equipo', category: 'Food', amount: -64 },
  {
    daysAgo: 43,
    description: 'Factura del agua',
    category: 'Utilities',
    amount: -88,
  },
  {
    daysAgo: 40,
    description: 'Concierto',
    category: 'Entertainment',
    amount: -52,
  },
  {
    daysAgo: 37,
    description: 'Compra Lidl',
    category: 'Groceries',
    amount: -120,
  },
  { daysAgo: 34, description: 'Cafetería', category: 'Dining', amount: -41 },
  {
    daysAgo: 31,
    description: 'Taxi al aeropuerto',
    category: 'Transportation',
    amount: -58,
  },

  // ── Oldest cycle (charts / history only) ──────────────────────────────
  {
    daysAgo: 88,
    description: 'Nómina mensual',
    category: 'Salary',
    amount: 3200,
  },
  {
    daysAgo: 86,
    description: 'Alquiler del piso',
    category: 'Rent',
    amount: -850,
  },
  {
    daysAgo: 83,
    description: 'Compra semanal Mercadona',
    category: 'Groceries',
    amount: -145,
  },
  {
    daysAgo: 79,
    description: 'Comida a domicilio',
    category: 'Food',
    amount: -49,
  },
  {
    daysAgo: 75,
    description: 'Gasolina',
    category: 'Transportation',
    amount: -118,
  },
  {
    daysAgo: 71,
    description: 'Factura de la luz',
    category: 'Utilities',
    amount: -84,
  },
  { daysAgo: 68, description: 'Cine', category: 'Entertainment', amount: -38 },
  {
    daysAgo: 65,
    description: 'Compra Carrefour',
    category: 'Groceries',
    amount: -102,
  },
  { daysAgo: 62, description: 'Zapatillas', category: 'Shopping', amount: -65 },
];

const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
};

async function seed(): Promise<void> {
  const dataSource = await AppDataSource.initialize();

  try {
    await dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const settingsRepo = manager.getRepository(UserSettings);
      const transactionRepo = manager.getRepository(Transaction);
      const budgetRepo = manager.getRepository(Budget);

      // ── User: create once, reset its password/role on every run ──────
      let user = await userRepo.findOne({ where: { email: SEED_USER.email } });

      if (user) {
        // Reset child data first. Raw QueryBuilder deletes avoid TypeORM's
        // nested-relation criteria (`{ user: { id } }`), which `delete()`
        // does not translate into SQL for these entities.
        await transactionRepo
          .createQueryBuilder()
          .delete()
          .where('"userId" = :userId', { userId: user.id })
          .execute();
        await budgetRepo
          .createQueryBuilder()
          .delete()
          .where('"userId" = :userId', { userId: user.id })
          .execute();

        user.name = SEED_USER.name;
        user.surname = SEED_USER.surname;
        user.password = SEED_USER.password; // re-hashed by @BeforeUpdate
        user.role = 'admin';
        user.authProvider = 'email';
        user.isPremium = true;
        user = await userRepo.save(user);
      } else {
        user = await userRepo.save(
          userRepo.create({
            name: SEED_USER.name,
            surname: SEED_USER.surname,
            email: SEED_USER.email,
            password: SEED_USER.password, // hashed by @BeforeInsert
            role: 'admin',
            authProvider: 'email',
            isPremium: true,
            refreshToken: null,
          }),
        );
      }

      // ── Settings: EUR + Spanish, onboarding already completed ────────
      const settings =
        (await settingsRepo.findOne({ where: { user: { id: user.id } } })) ??
        settingsRepo.create({ user: { id: user.id } as User });
      settings.timezone = 'Europe/Madrid';
      settings.currency = CURRENCY;
      // Must be one of the app's supported locales (en-US | es-CO) — any
      // other value makes `switchLanguage` fall back to English.
      settings.locale = 'es-CO';
      settings.hasCompletedOnboarding = true;
      await settingsRepo.save(settings);

      // ── Transactions ────────────────────────────────────────────────
      await transactionRepo.save(
        TRANSACTIONS.map((transaction) =>
          transactionRepo.create({
            date: daysAgo(transaction.daysAgo),
            description: transaction.description,
            category: transaction.category,
            amount: transaction.amount,
            recurrence: null,
            user: { id: user.id } as User,
          }),
        ),
      );

      // ── Budgets ─────────────────────────────────────────────────────
      // Spending budget: stored `spent` is only the manual baseline (0);
      // the API adds transaction spending on read, so the seeded expenses
      // above drive the progress bars without duplicating amounts here.
      await budgetRepo.save(
        budgetRepo.create({
          name: 'Monthly Budget',
          period: 'Monthly',
          type: 'spending',
          startDate: daysAgo(BUDGET_WINDOW_DAYS - 1),
          endDate: daysAgo(0),
          totalAllocated: 2000,
          totalSpent: 0,
          user: { id: user.id } as User,
          categories: [
            {
              name: 'Rent',
              currency: CURRENCY,
              allocated: 900,
              manualSpent: 0,
              spent: 0,
            },
            {
              name: 'Groceries',
              currency: CURRENCY,
              allocated: 500,
              manualSpent: 0,
              spent: 0,
            },
            {
              name: 'Transportation',
              currency: CURRENCY,
              allocated: 350,
              manualSpent: 0,
              spent: 0,
            },
            {
              name: 'Food',
              currency: CURRENCY,
              allocated: 250,
              manualSpent: 0,
              spent: 0,
            },
          ],
        }),
      );

      // Savings budget: progress is purely the manually saved amount.
      await budgetRepo.save(
        budgetRepo.create({
          name: 'Vacation Fund',
          period: 'Yearly',
          type: 'savings',
          startDate: daysAgo(89),
          endDate: new Date(new Date().getFullYear(), 11, 31),
          totalAllocated: SAVINGS_GOAL,
          totalSpent: SAVED_AMOUNT,
          user: { id: user.id } as User,
          categories: [
            {
              name: 'Transportation',
              currency: CURRENCY,
              allocated: SAVINGS_GOAL,
              manualSpent: SAVED_AMOUNT,
              spent: SAVED_AMOUNT,
            },
          ],
        }),
      );
    });

    console.log('✅ Seed completado');
    console.log(
      `   Usuario:        ${SEED_USER.email} / ${SEED_USER.password}`,
    );
    console.log(`   Transacciones:  ${TRANSACTIONS.length} (últimos 3 meses)`);
    console.log(
      '   Presupuestos:   2 (Monthly Budget · gasto, Vacation Fund · ahorro)',
    );
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error) => {
  console.error('❌ El seed falló:', error);
  process.exitCode = 1;
});
