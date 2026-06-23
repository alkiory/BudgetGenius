import { Test, TestingModule } from '@nestjs/testing';
import { ReportService } from '@application/dashboard/services/reports.service';
import { ReportRepository } from '@adapters/dashboard/persistence/reports.repository';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';

// Mock the openai module so ReportService constructor + getInsights() do not
// require real network access. The MVP contract under test is that
// ReportService no longer reads user.isPremium — openai specifics are out of
// scope.
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: '1. Insight A\n2. Insight B\n3. Insight C',
                },
              },
            ],
          }),
        },
      },
    })),
    Configuration: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: '1. Insight A\n2. Insight B\n3. Insight C',
                },
              },
            ],
          }),
        },
      },
    })),
  };
});

/**
 * MVP launch contract: every public method of ReportService must return the
 * underlying repository data without consulting the user's `isPremium` flag.
 */
describe('ReportService — MVP isPremium gate removed (T3.26)', () => {
  let service: ReportService;
  let userRepo: jest.Mocked<UserRepositoryImpl>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        {
          provide: ReportRepository,
          useValue: {
            getMonthlyOverview: jest
              .fn()
              .mockResolvedValue([{ month: 'Jan', income: 100, expenses: 50 }]),
            getCategoryBreakdown: jest
              .fn()
              .mockResolvedValue([{ category: 'Food', total: 100 }]),
            getWeeklyTrend: jest
              .fn()
              .mockResolvedValue([{ day: 'Mon', amount: 25 }]),
            getSavingsGrowth: jest
              .fn()
              .mockResolvedValue([{ month: 'Jan', savings: 50 }]),
          },
        },
        {
          provide: UserRepositoryImpl,
          useValue: {
            // User intentionally lacks `isPremium` — the test must still pass.
            findById: jest.fn().mockResolvedValue({ id: 1, name: 'Test' }),
          },
        },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
    userRepo = module.get(UserRepositoryImpl);
  });

  it('getOverview returns repo data without consulting isPremium', async () => {
    const result = await service.getOverview({ year: 2026, userId: 1 });
    expect(result).toEqual([{ month: 'Jan', income: 100, expenses: 50 }]);
    expect(userRepo.findById).not.toHaveBeenCalled();
  });

  it('getByCategory returns repo data without consulting isPremium', async () => {
    const result = await service.getByCategory({
      start: new Date('2026-01-01'),
      end: new Date('2026-01-31'),
      userId: 1,
    });
    expect(result).toEqual([{ category: 'Food', total: 100 }]);
    expect(userRepo.findById).not.toHaveBeenCalled();
  });

  it('getWeekly returns repo data without consulting isPremium', async () => {
    const result = await service.getWeekly({ userId: 1 });
    expect(result).toEqual([{ day: 'Mon', amount: 25 }]);
    expect(userRepo.findById).not.toHaveBeenCalled();
  });

  it('getSavings returns repo data without consulting isPremium', async () => {
    const result = await service.getSavings({ year: 2026, userId: 1 });
    expect(result).toEqual([{ month: 'Jan', savings: 50 }]);
    expect(userRepo.findById).not.toHaveBeenCalled();
  });

  it('getInsights does not short-circuit on missing isPremium and runs cleanup path', async () => {
    // With openai mocked, the retry loop's first call resolves cleanly.
    // The contract: NO `return []` short-circuit before the openai call —
    // assertion verifies the content reaches through, proving the gate
    // removal at the cleaned entry point. userId is forwarded for the
    // same scoping reason as the other report endpoints.
    const result = await service.getInsights({ year: 2026, userId: 1 });
    expect(typeof result).toBe('string');
    expect(userRepo.findById).not.toHaveBeenCalled();
  });
});
