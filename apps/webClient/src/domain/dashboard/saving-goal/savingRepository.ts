import { SavingGoal } from "./saving.entity";

export interface SavingGoalRepository {
  getAll(): Promise<SavingGoal[]>;
  getById(id: number): Promise<SavingGoal> | null;
  getByName(name: string): Promise<SavingGoal> | null;
  createSavingGoal({dto}: {dto: Omit<SavingGoal, "id">}): Promise<SavingGoal>;
  updateSavingGoal({dto}: {dto: Partial<SavingGoal>}): Promise<SavingGoal>;
  deleteSavingGoal(savingGoalId: number): Promise<void>;
  deleteAllSavingGoals(): Promise<void>;
}