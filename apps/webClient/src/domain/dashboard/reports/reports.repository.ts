/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ReportsRepository {
  getOverview: ({ year }: { year: string }) => Promise<any>;
  getCategories: ({
    start,
    end,
  }: {
    start: string;
    end: string;
  }) => Promise<any>;
  getWeekly: () => Promise<any>;
  getSavings: ({ year }: { year: string }) => Promise<any>;
  getInsights: ({ year }: { year: string }) => Promise<any>;
}
