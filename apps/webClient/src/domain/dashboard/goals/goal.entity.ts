export interface Goal {
  id: number
  name: string
  description?: string | null
  type: GoalType
  targetAmount: number
  currentAmount: number
  startDate: string
  dueDate: string
  status?: "active" | "completed" | "cancelled"
  contributionFrequency?: "daily" | "weekly" | "monthly"
  notes?: string
}

export type GoalType = "short-term" | "debt-payoff" | "emergency-fund" | "big-purchase" | "investment"

export const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: "short-term", label: "Short-Term Goal" },
  { value: "debt-payoff", label: "Debt Payoff" },
  { value: "emergency-fund", label: "Emergency Fund" },
  { value: "big-purchase", label: "Big Purchase" },
  { value: "investment", label: "Investment" },
]

export type goalProgress = {
  goalId: number
  amount: number
}

// Tipo para los filtros
export type GoalFilterType = GoalType | "all"

// Helper types para type safety
export type GoalProgress = {
  totalTarget: number
  totalCurrent: number
  percentComplete: number
  goalsCount: number
  completedCount: number
}