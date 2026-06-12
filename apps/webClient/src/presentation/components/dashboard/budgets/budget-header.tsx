import { Button } from "@presentation/components/ui/button";
import { CalendarIcon, Edit2 } from "lucide-react";

export default function BudgetHeader({ name, startDate, endDate, period, handleEditBudgetClick }: {
  name: string;
  startDate: Date;
  endDate: Date;
  period: string;
  handleEditBudgetClick: () => void;
}) {
  return (
    < div className="flex items-center justify-between" >
      <div>
        <h2 className="text-xl font-semibold">{name}</h2>
        <div className="mt-1 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          <CalendarIcon className="h-4 w-4" />
          <span>
            {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
          </span>
          <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-700">
            {period}
          </span>
        </div>
      </div>
      <Button variant="outline" size="sm" className="gap-1" onClick={handleEditBudgetClick}>
        <Edit2 className="h-4 w-4" />
        Edit Budget
      </Button>
    </div >
  )
}