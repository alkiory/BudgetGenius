import { Goal, GoalFilterType } from "@domain/dashboard/goals/goal.entity"
import { useMemo } from "react"

// Custom hook para filtrar metas
export const useFilteredGoals = (goals?: Goal[], searchTerm = "", selectedType: GoalFilterType = "all") => {
  return useMemo(() => {
    if (!goals) return []

    const lowerSearch = searchTerm.toLowerCase()

    return goals.filter(goal => {
      const matchesSearch =
        goal.name.toLowerCase().includes(lowerSearch) ||
        goal.description?.toLowerCase().includes(lowerSearch)

      const matchesType = selectedType === "all" || goal.type === selectedType

      return matchesSearch && matchesType
    })
  }, [goals, searchTerm, selectedType])
}