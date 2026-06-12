import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HttpReportRepository } from '@adapters/http/reports.repository';

export const useOverview = ({ year }: { year: string }) => {
  const queryClient = useQueryClient();

  const cancelOverviewQuery = () => {
    queryClient.cancelQueries({ queryKey: ['reports', 'overview', year] });
  };

  return {
    ...useQuery({
      queryKey: ['reports', 'overview', year],
      queryFn: () => HttpReportRepository.getOverview({ year }),
      enabled: year !== undefined,
      retry: 2,
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 5,
    }),
    cancelOverviewQuery
  };
}

export const useCategoryBreakdown = ({ start, end }: { start: string, end: string }) => {
  const queryClient = useQueryClient();

  const cancelCategoryBreakdownQuery = () => {
    queryClient.cancelQueries({ queryKey: ['reports', 'categories', start, end] });
  };

  return {
    ...useQuery({
      queryKey: ['reports', 'categories', start, end],
      queryFn: () => HttpReportRepository.getCategories({ start, end }),
      enabled: start !== undefined && end !== undefined,
      retry: 2,
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 5,
    }),
    cancelCategoryBreakdownQuery
  };
}

export const useWeeklyTrend = () => {
  const queryClient = useQueryClient();

  const cancelWeeklyTrendQuery = () => {
    queryClient.cancelQueries({ queryKey: ['reports', 'weekly'] });
  };

  return {
    ...useQuery({
      queryKey: ['reports', 'weekly'],
      queryFn: HttpReportRepository.getWeekly,
      retry: 2,
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 5,
    }),
    cancelWeeklyTrendQuery
  };
}

export const useSavingsGrowth = ({ year }: { year: string }) => {
  const queryClient = useQueryClient();

  const cancelSavingsGrowthQuery = () => {
    queryClient.cancelQueries({ queryKey: ['reports', 'savings', year] });
  };

  return {
    ...useQuery({
      queryKey: ['reports', 'savings', year],
      queryFn: () => HttpReportRepository.getSavings({ year }),
      enabled: year !== undefined,
      retry: 2,
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 5,
    }),
    cancelSavingsGrowthQuery
  };
}

export const useInsights = ({ year }: { year: string }) => {
  const queryClient = useQueryClient();

  const cancelInsightsQuery = () => {
    queryClient.cancelQueries({ queryKey: ['reports', 'insights', year] });
  };

  return {
    ...useQuery({
      queryKey: ['reports', 'insights', year],
      queryFn: () => HttpReportRepository.getInsights({ year }),
      enabled: year !== undefined,
      retry: 2,
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 5,
    }),
    cancelInsightsQuery
  };
}