import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppApiKey } from '@domain/superadmin/app-api-key.entity';
import { AppModule as AppModuleEntity } from '@domain/superadmin/app-module.entity';
import { AppNotification } from '@domain/superadmin/app-notification.entity';
import { AppProviderKey } from '@domain/superadmin/app-provider-key.entity';
import { Budget } from '@domain/dashboard/budget.entity';
import { ExpenseCategory } from '@domain/dashboard/expense-category.entity';
import { Transaction } from '@domain/dashboard/transaction.entity';
import { User } from '@domain/user/user.entity';
import { AppApiKeyService } from '@application/superadmin/app-api-key.service';
import { AppModuleService } from '@application/superadmin/app-module.service';
import { AppNotificationService } from '@application/superadmin/app-notification.service';
import { AppProviderKeyService } from '@application/superadmin/app-provider-key.service';
import { SuperAdminOverviewService } from '@application/superadmin/superadmin-overview.service';
import { SuperAdminController } from '@adapters/superadmin/http/superadmin.controller';
import { AppModuleController } from '@adapters/superadmin/http/app-module.controller';
import { AppApiKeyController } from '@adapters/superadmin/http/app-api-key.controller';
import { AppNotificationController } from '@adapters/superadmin/http/app-notification.controller';
import { AppProviderKeyController } from '@adapters/superadmin/http/app-provider-key.controller';
import { LoggingService } from '@infrastructure/log/logger.service';

/**
 * Superadmin backoffice: modules, API keys, announcements and usage metrics.
 * Scope is the product, never individual accounts — see
 * `SuperAdminOverviewService`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppModuleEntity,
      AppApiKey,
      AppNotification,
      AppProviderKey,
      User,
      Transaction,
      Budget,
      ExpenseCategory,
    ]),
  ],
  controllers: [
    SuperAdminController,
    AppModuleController,
    AppApiKeyController,
    AppNotificationController,
    AppProviderKeyController,
  ],
  providers: [
    AppModuleService,
    AppApiKeyService,
    AppNotificationService,
    AppProviderKeyService,
    SuperAdminOverviewService,
    LoggingService,
  ],
})
export class SuperAdminModule {}
