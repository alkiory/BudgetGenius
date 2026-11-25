import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppModule as AppModuleEntity } from '@domain/superadmin/app-module.entity';
import { ModuleCatalogService } from '@application/catalog/module-catalog.service';
import { ModuleCatalogController } from '@adapters/catalog/http/module-catalog.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AppModuleEntity])],
  controllers: [ModuleCatalogController],
  providers: [ModuleCatalogService],
})
export class CatalogModule {}
