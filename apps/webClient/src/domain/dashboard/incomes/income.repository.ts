import { Income, RootPromise } from "./income.entity";

export interface IncomeRepository {
  getAll: (offset: number, limit: number) => Promise<RootPromise>;
  createIncome: ({ dto }: { dto: Omit<Income, "id"> }) => Promise<Income>;
  updateIncome: ({ dto }: { dto: Partial<Income> }) => Promise<Income>;
  deleteIfOwned: (id: number) => Promise<boolean>;
  deleteAll: () => Promise<void>;
}
