import { Goal, GoalProgress } from "@domain/dashboard/goals/goal.entity";
import { useMemo } from "react";

// Custom hook para cálculos de progreso
export const useGoalProgress = (goals?: Goal[]) => {
  return useMemo<GoalProgress>(() => {
    if (!goals?.length) {
      return {
        totalTarget: 0,
        totalCurrent: 0,
        percentComplete: 0,
        goalsCount: 0,
        completedCount: 0,
      };
    }

    const totals = goals.reduce(
      (acc, goal) => ({
        totalTarget: acc.totalTarget + goal.targetAmount,
        totalCurrent: acc.totalCurrent + goal.currentAmount,
        goalsCount: acc.goalsCount + 1,
        completedCount:
          acc.completedCount + (goal.status === "completed" ? 1 : 0),
      }),
      { totalTarget: 0, totalCurrent: 0, goalsCount: 0, completedCount: 0 },
    );

    const percentComplete =
      totals.totalTarget > 0
        ? (totals.totalCurrent / totals.totalTarget) * 100
        : 0;

    return { ...totals, percentComplete };
  }, [goals]);
};
