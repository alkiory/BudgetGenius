import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell, BarChart } from "recharts";

export default function BudgetSpendingByCategory({ chartData }: {
  chartData: {
    name: string
    allocated: number
    spent: number
    percentUsed: number
  }[]
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Spending by Category</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={100} />
            <Tooltip
              formatter={(value, name) => [
                `$${Number(value).toFixed(2)}`,
                name === "allocated" ? "Allocated" : "Spent",
              ]}
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
    </div>
  )
}