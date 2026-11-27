import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppModule as AppModuleEntity } from '@domain/superadmin/app-module.entity';
import { User } from '@domain/user/user.entity';
import { AppCatalogService } from '@application/catalog/app-catalog.service';
import { AppCatalogController } from '@adapters/catalog/http/app-catalog.controller';

/**
 * Read-only catalogue consumed by the app chrome (sidebar + catalogue page).
 * Authoring stays in `SuperAdminModule`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AppModuleEntity, User])],
  controllers: [AppCatalogController],
  providers: [AppCatalogService],
})
export class AppCatalogModule {}
