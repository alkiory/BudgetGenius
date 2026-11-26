/**
 * Savings deposits are identified by their link to a savings-budget category,
 * not by the transaction's category label. The label check used to hide
 * ordinary imported transactions that happened to be labelled "Savings" from
 * reports and the dashboard totals.
 */

import { ReportRepository } from '@adapters/dashboard/persistence/reports.repository';
import { OverviewRepository } from '@adapters/dashboard/persistence/overview.repository';

const queryBuilder = () => {
  const filters: string[] = [];
  const joins: string[] = [];
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn((_entity: unknown, alias: string, condition: string) => {
      joins.push(`${alias}:${condition}`);
      return builder;
    }),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn((sql: string) => {
      filters.push(sql);
      return builder;
    }),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue({ income: '0', expense: '0' }),
  };
  return { builder, filters, joins };
};

describe('savings exclusion in aggregates', () => {
  it('reports join the linked budget instead of filtering by category text', async () => {
    const { builder, filters, joins } = queryBuilder();
    const repo = new ReportRepository({
      createQueryBuilder: jest.fn(() => builder),
    } as any);

    await repo.getMonthlyOverview(2026, 1);

    expect(joins).toContain('bc:bc.id = tx."budgetCategoryId"');
    expect(joins).toContain('b:b.id = bc."budgetId"');
    expect(filters).toContain("(b.type IS NULL OR b.type <> 'savings')");
    expect(filters.some((sql) => sql.includes('LOWER(tx.category)'))).toBe(
      false,
    );
  });

  it('overview filters ordinary Savings-labelled rows in, deposits out', async () => {
    const { builder, filters, joins } = queryBuilder();
    const dataSource = {
      getRepository: jest.fn(() => ({
        createQueryBuilder: jest.fn(() => builder),
      })),
    };
    const repo = new OverviewRepository(dataSource as any);

    await repo.getExpensesByCategory(1);

    expect(joins).toContain('bc:bc.id = tx."budgetCategoryId"');
    expect(filters).toContain("(b.type IS NULL OR b.type <> 'savings')");
    expect(filters.some((sql) => sql.includes('LOWER(tx.category)'))).toBe(
      false,
    );
  });
});
