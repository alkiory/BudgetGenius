import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell, BarChart } from "recharts";
import {
  OverBudgetContainer,
  OverBudgetHeader,
  OverBudgetBadge,
} from "@presentation/components/ui/budget-status";

interface ChartEntry {
  name: string
  allocated: number
  spent: number
  percentUsed: number
}

export default function BudgetSpendingByCategory({ chartData }: {
  chartData: ChartEntry[]
}) {
  const hasOverBudget = chartData.some(d => d.percentUsed > 100);
  const overBudgetCount = chartData.filter(d => d.percentUsed > 100).length;

  return (
    <OverBudgetContainer isOverBudget={hasOverBudget}>
      <OverBudgetHeader
        isOverBudget={hasOverBudget}
        title="Spending by Category"
        iconSize="md"
        badge={hasOverBudget ? `${overBudgetCount} ${overBudgetCount === 1 ? 'category over' : 'categories over'} budget` : undefined}
      />

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={100} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const entry = chartData.find(d => d.name === label);
                if (!entry) return null;
                const isOver = entry.percentUsed > 100;
                const overAmount = entry.spent - entry.allocated;

                return (
                  <div className="rounded-lg border bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    <p className="mb-1 font-medium">{label}</p>
                    {payload.map((p, i) => (
                      <p key={i} className="text-sm">
                        <span className="font-medium">{p.name}:</span>{' '}
                        ${Number(p.value).toFixed(2)}
                      </p>
                    ))}
                    {isOver && (
                      <p className="mt-1 text-sm font-medium text-red-600 dark:text-red-400">
                        ⚠ Over budget by ${overAmount.toFixed(2)}
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Bar dataKey="allocated" name="Allocated" fill="#8884d8" />
            <Bar dataKey="spent" name="Spent" fill="#82ca9d">
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.percentUsed > 100 ? "#ef4444" : entry.percentUsed > 90 ? "#f59e0b" : "#10b981"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </OverBudgetContainer>
  )
}