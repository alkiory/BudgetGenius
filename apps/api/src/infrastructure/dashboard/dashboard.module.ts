import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggingService } from '@infrastructure/log/logger.service';
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
import { Income } from '@domain/dashboard/income.entity';
import { IncomeController } from '@adapters/dashboard/http/income.controller';
import { IncomeRepository } from '@adapters/dashboard/persistence/income.repository';
import { IncomeService } from '@application/dashboard/services/income.service';
import { OverviewController } from '@adapters/dashboard/http/overview.controller';
import { OverviewService } from '@application/dashboard/services/overview.service';
import { BudgetCategory } from '@domain/dashboard/budget-category.entity';
import { Goal } from '@domain/dashboard/goal.entity';
import { GoalController } from '@adapters/dashboard/http/goal.controller';
import { GoalService } from '@application/dashboard/services/goal.service';
import { GoalRepository } from '@adapters/dashboard/persistence/goal.repository';
import { ReportsController } from '@adapters/dashboard/http/reports.controller';
import { ReportService } from '@application/dashboard/services/reports.service';
import { ReportRepository } from '@adapters/dashboard/persistence/reports.repository';
import { OverviewRepository } from '@adapters/dashboard/persistence/overview.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExpenseCategory,
      Budget,
      BudgetCategory,
      Transaction,
      Overview,
      User,
      Income,
      Goal,
    ]),
  ],
  controllers: [
    TransactionController,
    BudgetController,
    IncomeController,
    OverviewController,
    GoalController,
    ReportsController,
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
    IncomeRepository,
    IncomeService,
    OverviewService,
    GoalService,
    GoalRepository,
    ReportService,
    ReportRepository,
    OverviewRepository,
  ],
  exports: [TransactionService, BudgetService],
})
export class DashboardModule {}
