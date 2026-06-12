import { RootState } from '@adapters/store/rootStore';
import { BudgetCategory } from '@domain/dashboard/budgets/budget.entity';
import { Button } from '@presentation/components/ui/button';
import { Input } from '@presentation/components/ui/input';
import { Label } from '@presentation/components/ui/label';
import { Currency, currencyService } from '@presentation/utils/currencyService';
import { useState } from 'react';
import { useSelector } from 'react-redux';

interface Props {
  category: BudgetCategory;
  onUpdateSpent: (categoryId: number, spent: number) => void;
  onDeleteCategory: (category: BudgetCategory) => void;
}

export const EditableBudgetCategory: React.FC<Props> = ({ category, onUpdateSpent, onDeleteCategory }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localSpent, setLocalSpent] = useState(category.spent);

  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    setLocalSpent(category.spent);
  };

  const handleSaveClick = () => {
    if (!category) return;
    onUpdateSpent(category.id as number, localSpent);
    setIsEditing(false);
  };

  const handleLocalSpentChange = (value: string) => {
    const spent = Number(value) || 0;
    setLocalSpent(spent);
  };

  const targetCurrency = (settings?.currency || 'USD') as Currency;

  const formattedSpent = currencyService.formatCurrency(
    category.spent,
    targetCurrency as Currency,
    targetCurrency,
    false
  )

  return (
    <div className="mt-3 flex items-center justify-between">
      <div className="flex-1">
        <Label htmlFor={`category-spent-${category.id}`} className="text-xs">
          {isEditing ? 'Update Spent Amount' : 'Spent'}
        </Label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{formattedSpent.symbol}</span>
          {isEditing ? (
            <Input
              id={`category-spent-${category.id}`}
              type="number"
              min="0"
              step="0.01"
              value={localSpent}
              onChange={(e) => handleLocalSpentChange(e.target.value)}
              className="pl-7"
            />
          ) : (
            <span className="pl-7">{formattedSpent.amount}</span>
          )}
        </div>
      </div>
      <div className="flex items-center">
        {!isEditing ? (
          <Button variant="default" size="sm" className="ml-2" onClick={handleEditClick}>
            Edit
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" className="ml-2" onClick={handleSaveClick}>
              Save
            </Button>
            <Button variant="ghost" size="sm" className="ml-2" onClick={handleCancelClick}>
              Cancel
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteCategory(category);
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  );
};