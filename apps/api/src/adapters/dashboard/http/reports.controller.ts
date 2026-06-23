import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import {
  ExportLocale,
  ReportExportService,
  ReportFormat,
} from '@application/dashboard/services/report-export.service';
import { ReportService } from '@application/dashboard/services/reports.service';

/**
 * Locale coercion: only allow the canonical short-list we render labels
 * for. Anything else silently falls back to `en-US` to keep the contract
 * permissive (existing clients that omit `locale` keep working) and avoid
 * 400s on user-driven mistakes.
 */
function resolveLocale(input: string | undefined): ExportLocale {
  return input === 'es-CO' ? 'es-CO' : 'en-US';
}

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private svc: ReportService,
    private exportSvc: ReportExportService,
  ) {}

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Monthly income vs expenses overview' })
  @ApiQuery({ name: 'year', required: true, example: 2025 })
  @ApiResponse({ status: 200, description: 'Overview data' })
  getOverview(@Query('year') year: number, @Req() req) {
    return this.svc.getOverview({ year, userId: req.user.userId });
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
    return this.svc.getWeekly({ userId: req.user.userId });
  }

  @Get('savings')
  @ApiOperation({ summary: 'Savings growth per month' })
  @ApiQuery({ name: 'year', required: true })
  getSavings(@Query('year') year: number, @Req() req) {
    return this.svc.getSavings({ year, userId: req.user.userId });
  }

  @Get('insights')
  @ApiOperation({ summary: 'AI-generated insights' })
  @ApiQuery({ name: 'year', required: true })
  @ApiResponse({ status: 200, description: 'Text insights' })
  getInsights(@Query('year') year: number, @Req() req) {
    // TODO: Service temporarily disabled until we pay the bill. When
    // re-enabled, MUST call `this.svc.getInsights({year, userId: req.user.userId})`
    // — the service's `getInsights` signature requires `userId` after the
    // cross-layer permission audit; passing only `{year}` would type-fail
    // and un-scoped calls would leak aggregated data across users.
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

  /**
   * Streams a downloadable report (PDF or Excel) for the given year. The
   * request is authenticated via JwtAuthGuard (set at the controller
   * level), so the export is always scoped to req.user.userId.
   *
   * The response is binary; the controller sets the Content-Type and
   * Content-Disposition headers directly and hands the Buffer to Express.
   */
  @Get('export')
  @ApiOperation({
    summary: 'Download a PDF or Excel report for the requested year',
  })
  @ApiQuery({
    name: 'format',
    required: true,
    enum: ['pdf', 'excel'],
    description:
      'Output format. "pdf" streams application/pdf; "excel" streams application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.',
  })
  @ApiQuery({
    name: 'year',
    required: true,
    type: Number,
    example: 2025,
  })
  @ApiQuery({
    name: 'locale',
    required: false,
    enum: ['en-US', 'es-CO'],
    description:
      'Optional UI locale used to localize month names (and a few English labels) inside the report. Defaults to en-US.',
  })
  @ApiProduces('application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiResponse({
    status: 200,
    description: 'Binary file stream (Content-Disposition: attachment)',
  })
  @ApiResponse({ status: 400, description: 'Invalid format or year' })
  async export(
    @Req() req,
    @Res() res: Response,
    @Query('format') format: string,
    @Query('year') year: string,
    @Query('locale') localeParam?: string,
  ): Promise<void> {
    const normalized = (format ?? '').toLowerCase() as ReportFormat;
    if (normalized !== 'pdf' && normalized !== 'excel') {
      throw new BadRequestException(
        `Invalid format "${format}". Allowed values: pdf | excel.`,
      );
    }

    const currentYear = new Date().getFullYear();
    const yearNumber = Number(year);
    // Guard against fat-finger values that would otherwise scan a useless
    // Postgres range. Upper bound = current year + 5 keeps some room for
    // back-fill scenarios while still rejecting obviously bad input.
    if (
      !year ||
      Number.isNaN(yearNumber) ||
      yearNumber < 1900 ||
      yearNumber > currentYear + 5
    ) {
      throw new BadRequestException(
        `Invalid year "${year}". Provide a numeric year between 1900 and ${currentYear + 5}.`,
      );
    }

    const userId = req.user.userId;
    // Locale is optional and validated at the coercion layer — anything
    // outside the supported set quietly falls back to en-US so the
    // report still renders.
    const locale = resolveLocale(localeParam);
    const payload = await this.exportSvc.export(
      userId,
      yearNumber,
      normalized,
      locale,
    );

    res.setHeader('Content-Type', payload.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${payload.filename}"`,
    );
    res.setHeader('Content-Length', payload.buffer.length.toString());
    // Disable Nest's auto-content-length recomputation; we already set it.
    res.send(payload.buffer);
  }
}
