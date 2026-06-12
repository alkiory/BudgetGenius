import { RootState } from "@adapters/store/rootStore";
import { Income } from "@domain/dashboard/incomes/income.entity";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { timezoneToLocale } from "@presentation/utils/localeInspector";
import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ConvertedMonthlyData {
  monthYear: string;
  formattedMonth: string;
  originalAmount: number;
  convertedAmount: number;
  formattedConvertedAmount: string;
}

interface IncomeHistoryProps {
  incomeTransactions: Income[];
}

export function IncomeHistory({ incomeTransactions }: IncomeHistoryProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const { settings } = userSetting;

  const formattedLocale = timezoneToLocale(settings?.timezone);
  const targetCurrency = (settings?.currency || 'USD') as Currency;

  const chartData: ConvertedMonthlyData[] = useMemo(() => {
    const data: Record<string, number> = {};

    const sortedTransactions = [...incomeTransactions].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    sortedTransactions.forEach((transaction) => {
      const date = new Date(transaction.createdAt);
      const monthYearKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!data[monthYearKey]) {
        data[monthYearKey] = 0;
      }
      data[monthYearKey] += transaction.amount;
    });

    const processedData = Object.entries(data).map(([monthYear, originalAmount]) => {
      const [year, month] = monthYear.split("-");
      const dateForFormatting = new Date(Number.parseInt(year), Number.parseInt(month) - 1);

      const converted = currencyService.formatCurrency(
        originalAmount,
        'USD' as Currency,
        targetCurrency,
        false
      );

      return {
        monthYear: monthYear,
        formattedMonth: dateForFormatting.toLocaleString(formattedLocale, {
          month: "short",
          year: "2-digit",
        }),
        originalAmount: originalAmount,
        convertedAmount: converted.amount,
        formattedConvertedAmount: converted.formatted,
      };
    });

    return processedData.sort((a, b) => a.monthYear.localeCompare(b.monthYear));
  }, [incomeTransactions, targetCurrency, formattedLocale]);

  // --- Opcional: Calcular el total general convertido para mostrarlo fuera de la gráfica si es necesario ---
  const totalConvertedIncome = useMemo(() => {
    const totalOriginalAmount = incomeTransactions.reduce((acc, curr) => acc + curr.amount, 0);
    return currencyService.formatCurrency(
      totalOriginalAmount,
      'USD' as Currency,
      targetCurrency,
      false
    );
  }, [incomeTransactions, targetCurrency]);


  return (
    <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
      <h3 className="mb-4 text-lg font-medium">{t('income.history')}</h3>
      {chartData.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="formattedMonth"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(value: number) => totalConvertedIncome.symbol + value.toLocaleString(formattedLocale)}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number, name: string, props: any) => {
                  const formattedValue = props.payload.formattedConvertedAmount;
                  return [`${formattedValue}`, t('transactions.amount')];
                }}
                contentStyle={{
                  borderRadius: '8px',
                  border: 'none',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                  backgroundColor: '#ffffff',
                }}
              />
              <Line
                type="monotone"
                dataKey="convertedAmount"
                stroke="#8884d8"
                activeDot={{ r: 8 }}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="w-full h-[calc(100%-40px)] flex items-center justify-center">
          <p className="text-slate-500 dark:text-slate-400">{t('common.noData')}</p>
        </div>
      )}
    </div>
  );
}
