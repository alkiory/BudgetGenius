export type SavingGoal = {
  id: number;
  name: string;
  current: number;
  target: number;
  percentage?: number;
  targetDate?: Date;
  category: string;
  color?: string;
};