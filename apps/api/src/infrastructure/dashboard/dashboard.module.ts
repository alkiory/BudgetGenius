import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggingService } from '@infrastructure/log/logger.service';
import { UserSettingsModule } from '@infrastructure/user/user-settings.module';
import { TransactionController } from '@adapters/dashboard/http/transaction.controller';
import { TransactionService } from '@application/dashboard/services/transaction.service';
import { BudgetService } from '@application/dashboard/services/budget.service';
import { TransactionRepository } from '@adapters/dashboard/persistence/transaction.repository';
import { ExpenseCategoryService } from '@application/dashboard/services/expense-category.service';
import { ExpenseCategory } from '@domain/dashboard/expense-category.entity';
import { Budget } from '@domain/dashboard/budget.entity';
import { BudgetRepository } from '@adapters/dashboard/persistence/budget.repository';
import { Overview } from '@domain/dashboard/overview.entity';
import { Transaction } from '@domain/dashboard/transaction.entity';
import { ExpenseCategoryRepository } from '@adapters/dashboard/persistence/expense-category.repository';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';
import { User } from '@domain/user/user.entity';
import { BudgetController } from '@adapters/dashboard/http/budget.controller';
import { OverviewController } from '@adapters/dashboard/http/overview.controller';
import { OverviewService } from '@application/dashboard/services/overview.service';
import { BudgetCategory } from '@domain/dashboard/budget-category.entity';
import { ReportsController } from '@adapters/dashboard/http/reports.controller';
import { ReportService } from '@application/dashboard/services/reports.service';
import { ReportExportService } from '@application/dashboard/services/report-export.service';
import { ReportRepository } from '@adapters/dashboard/persistence/reports.repository';
import { OverviewRepository } from '@adapters/dashboard/persistence/overview.repository';
import { ExpenseCategoryController } from '@adapters/dashboard/http/expense-category.controller';
import { CurrencyService } from '@infrastructure/currency/currency.service';
import { CurrencyModule } from '@infrastructure/currency/currency.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExpenseCategory,
      Budget,
      BudgetCategory,
      Transaction,
      Overview,
      User,
    ]),
    // BudgetService.inject(UserSettingsService) needs the user-settings
    // module's exports. Re-providing locally would create a duplicate
    // UserSettingsService instance across modules — the canonical NestJS
    // pattern is to import the module that already provides+exports the
    // service.
    UserSettingsModule,
    CurrencyModule,
  ],
  controllers: [
    TransactionController,
    BudgetController,
    OverviewController,
    ReportsController,
    ExpenseCategoryController,
  ],
  providers: [
    LoggingService,
    TransactionService,
    BudgetService,
    TransactionRepository,
    ExpenseCategoryService,
    BudgetRepository,
    ExpenseCategoryRepository,
    UserRepositoryImpl,
    OverviewService,
    ReportService,
    ReportExportService,
    ReportRepository,
    OverviewRepository,
  ],
  exports: [TransactionService, BudgetService],
})
export class DashboardModule { }
