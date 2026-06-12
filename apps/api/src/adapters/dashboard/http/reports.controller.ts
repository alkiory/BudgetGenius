import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { ReportService } from '@application/dashboard/services/reports.service';
import { PremiumGuard } from '@infrastructure/config/guards/premium.guard';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, PremiumGuard)
export class ReportsController {
  constructor(private svc: ReportService) {}

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Monthly income vs expenses overview' })
  @ApiQuery({ name: 'year', required: true, example: 2025 })
  @ApiResponse({ status: 200, description: 'Overview data' })
  getOverview(@Query('year') year: number, @Req() req) {
    return this.svc.getOverview({
      year,
      userId: req.user.userId,
    });
  }

  @Get('categories')
  @ApiOperation({ summary: 'Expense breakdown by category' })
  @ApiQuery({ name: 'start' })
  @ApiQuery({ name: 'end' })
  getByCategory(
    @Query('start') start: string,
    @Query('end') end: string,
    @Req() req,
  ) {
    return this.svc.getByCategory({
      start: new Date(start),
      end: new Date(end),
      userId: req.user.userId,
    });
  }

  @Get('weekly')
  @ApiOperation({ summary: 'Weekly trend (last 7 days)' })
  @ApiResponse({ status: 200 })
  getWeekly(@Req() req) {
    return this.svc.getWeekly({
      userId: req.user.userId,
    });
  }

  @Get('savings')
  @ApiOperation({ summary: 'Savings growth per month' })
  @ApiQuery({ name: 'year', required: true })
  getSavings(@Query('year') year: number, @Req() req) {
    return this.svc.getSavings({
      year,
      userId: req.user.userId,
    });
  }

  @Get('insights')
  @ApiOperation({ summary: 'AI-generated insights' })
  @ApiQuery({ name: 'year', required: true })
  @ApiResponse({ status: 200, description: 'Text insights' })
  getInsights(@Query('year') year: number, @Req() req) {
    // TODO: Service temporarily disabled until we pay the bill
    // return this.svc.getInsights({
    //   year,
    //   userId: req.user.userId,
    // });
    return {
      data: {
        spent: 0,
        averageAmountExpenses: 0,
        expenseToIncomeRatio: 0,
      },
      year,
      userId: req.user.userId,
    };
  }
}
