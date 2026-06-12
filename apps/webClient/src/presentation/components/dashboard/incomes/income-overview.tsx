import { Income } from "@domain/dashboard/incomes/income.entity"
import { useMemo } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"

interface IncomeOverviewProps {
  incomeTransactions: Income[]
}

export function IncomeOverview({ incomeTransactions }: IncomeOverviewProps) {
  // Calculate income by month for the current year
  const incomeByMonth = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const monthlyData = Array(12).fill(0)

    incomeTransactions.forEach((transaction) => {
      const date = new Date(transaction.date)
      if (date.getFullYear() === currentYear) {
        const month = date.getMonth()
        monthlyData[month] += transaction.amount
      }
    })

    return monthlyData
  }, [incomeTransactions])

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
      <h3 className="mb-4 text-lg font-medium">Monthly Income Overview</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={incomeByMonth.map((amount, index) => ({
                name: new Date(0, index).toLocaleString("default", { month: "short" }),
                value: amount,
              }))}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => (percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : "")}
            >
              {incomeByMonth.map((_, index) => (
                <Cell key={`cell-${index}`} fill={`hsl(${index * 30}, 70%, 50%)`} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => (typeof value === "number" ? [`${value.toFixed(2)}`, "Income"] : [value, "Income"])} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
