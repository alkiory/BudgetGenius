import { ReportRepository } from '@adapters/dashboard/persistence/reports.repository';
import { Injectable } from '@nestjs/common';
import Configuration, { OpenAI } from 'openai';

@Injectable()
export class ReportService {
  private openai: OpenAI;

  constructor(private repo: ReportRepository) {
    this.openai = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
      project: process.env.OPENAI_PROJECT_ID,
    });
  }

  async getOverview({ year, userId }: { year: number; userId: number }) {
    return this.repo.getMonthlyOverview(year, userId);
  }

  async getByCategory({
    start,
    end,
    userId,
  }: {
    start: Date;
    end: Date;
    userId: number;
  }) {
    return this.repo.getCategoryBreakdown(start, end, userId);
  }

  async getWeekly({ userId }: { userId: number }) {
    return this.repo.getWeeklyTrend(userId);
  }

  async getSavings({ year, userId }: { year: number; userId: number }) {
    return this.repo.getSavingsGrowth(year, userId);
  }

  /** AI‑powered insights */
  async getInsights({ year, userId }: { year: number; userId: number }) {
    const maxAttempts = 3;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        // Forward userId so the underlying query is scoped to the
        // requesting user (closed-loop ownership after the security
        // audit). The current route is disabled by the controller
        // (returns a dummy payload), but the type-correct call keeps
        // the contract honest so a future re-enable can't regress the
        // scoping by accident.
        const overview = await this.getOverview({ year, userId });
        const prompt = `
        You are a helpful financial AI assistant designed to provide users with actionable insights based on their financial data.

        Here is the user's financial overview data for a specific month:

        ${JSON.stringify(overview)}
        This data includes 'month', 'income', and 'expenses'. Income and expenses are provided as string representations of numerical values.

        Your task is to provide exactly three concise and actionable financial insights for the user based strictly on this provided data.

        Guidelines for generating insights:

        Source Data: Base all insights only on the income and expense figures for the month provided in the overview object.
        Actionability: Each insight should highlight an observation from the data and suggest a potential consideration, action, or area for review for the user (e.g., potential savings, reviewing tracking, noting spending patterns if multiple months were available).
        Data Limitations: Since only data for one month is provided, avoid making statements about financial trends, comparisons to other periods, or long-term forecasts. Focus solely on the snapshot provided.
        Handling Zero Expenses: If 'expenses' is 0, state this observation clearly and perhaps suggest reviewing if all spending was recorded for the month, or highlight the resulting net income/potential savings. Do not suggest reducing spending if expenses are already zero.
        Conciseness: Keep each insight brief and easy to understand.
        Tone: Maintain a neutral, informative, and helpful tone.
        Output Format: Present the three insights as a numbered list (1., 2., 3.).
        Please generate the three insights now.
        `;
        const response: any = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          store: true,
          messages: [{ role: 'developer', content: prompt }],
        });

        if (response.status === 500) {
          throw new Error('Server error: 500');
        }

        return response.choices[0].message?.content || 'No insights available.';
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts || error.message.includes('500')) {
          throw new Error('Failed to get insights after multiple attempts.');
        }
      }
    }
  }
}
