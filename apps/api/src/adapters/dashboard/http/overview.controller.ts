import { OverviewService } from '@application/dashboard/services/overview.service';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
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
}
