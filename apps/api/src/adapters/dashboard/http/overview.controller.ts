import { OverviewService } from '@application/dashboard/services/overview.service';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import {
  Controller,
  Get,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Overview')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class OverviewController {
  constructor(private overviewSvc: OverviewService) {}

  @Get('overview')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get financial overview (balance, income, expenses)',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        income: 1000,
        expenses: 400,
        balance: 600,
        period: '2025-05-01',
      },
    },
  })
  async getOverview(@Req() req) {
    const { userId } = req.user;
    return this.overviewSvc.getOverview(userId);
  }

  @Get('expense-breakdown')
  @ApiOperation({
    summary: 'Get expense breakdown by category',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        total: 0,
        byCategory: [],
        largest: {
          name: '',
          value: 0,
        },
      },
    },
  })
  async expenseBreakdown(@Req() req) {
    return this.overviewSvc.getExpenseBreakdown(req.user.userId);
  }

  @Get('recent-summary')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get a recent transactions slice alongside all-time income/expense/net aggregate for the dashboard widget',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of recent transactions to return (default 50)',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        transactions: [
          {
            id: 42,
            date: '2025-05-12',
            description: 'Groceries',
            category: 'Food',
            amount: -42.3,
            status: 'Completed',
          },
        ],
        aggregate: {
          income: 1500,
          expense: 800,
          net: 700,
        },
      },
    },
  })
  async getRecentSummary(
    @Req() req,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.overviewSvc.getRecentSummary(req.user.userId, limit ?? 50);
  }
}
