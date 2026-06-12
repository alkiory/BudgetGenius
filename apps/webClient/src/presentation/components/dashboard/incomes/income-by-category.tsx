import { RootState } from "@adapters/store/rootStore";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { timezoneToLocale } from "@presentation/utils/localeInspector";
import { useSelector } from "react-redux";
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo } from 'react';

interface IncomeByCategoryProps {
  incomeByCategory: Array<{
    category: string;
    amount: number;
  }>;
}

interface ConvertedChartData {
  category: string;
  originalAmount: number;
  convertedAmount: number;
  formattedConvertedAmount: string;
}

export function IncomeByCategory({ incomeByCategory }: IncomeByCategoryProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const { settings } = userSetting;

  const targetCurrency = (settings?.currency || 'USD') as Currency;
  const formattedLocale = timezoneToLocale(settings?.timezone);

  const convertedSortedData: ConvertedChartData[] = useMemo(() => {
    const sortedOriginalData = [...incomeByCategory].sort((a, b) => b.amount - a.amount);

    return sortedOriginalData.map(item => {
      const converted = currencyService.formatCurrency(
        item.amount,
        'USD' as Currency,
        targetCurrency,
        false
      );

      return {
        category: item.category,
        originalAmount: item.amount,
        convertedAmount: converted.amount,
        formattedConvertedAmount: converted.formatted
      };
    });
  }, [incomeByCategory, targetCurrency]);


  // --- Opcional: Calcular el total general convertido para mostrarlo fuera de la gráfica si es necesario ---
  const totalConvertedIncome = useMemo(() => {
    const totalOriginalAmount = incomeByCategory.reduce((acc, curr) => acc + curr.amount, 0);
    return currencyService.formatCurrency(
      totalOriginalAmount,
      'USD' as Currency,
      targetCurrency,
      false
    );
  }, [incomeByCategory, targetCurrency]);


  return (
    <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800 w-full h-full min-h-[300px]">
      <h3 className="mb-3 text-lg font-medium">{t('income.byCategory')}</h3>
      {convertedSortedData.length > 0 ? (
        <div className="w-full h-[calc(100%-40px)] min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={convertedSortedData}
              layout="vertical"
              margin={{
                top: 5,
                right: 20,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                tickFormatter={(value: number) => totalConvertedIncome.symbol + value.toLocaleString(formattedLocale)}
              />
              <YAxis
                dataKey="category"
                type="category"
                tick={{ fontSize: 12 }}
                width={80}
                interval={0}
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
              <Bar
                dataKey="convertedAmount"
                fill="#10b981"
                radius={[0, 4, 4, 0]}
                animationDuration={1500}
              />
            </BarChart>
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
