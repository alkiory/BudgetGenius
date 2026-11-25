import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { ModuleCatalogService } from '@application/catalog/module-catalog.service';

/** Read-only catalogue of the modules the product currently offers. */
@ApiTags('modules')
@ApiBearerAuth()
@Controller('modules')
@UseGuards(JwtAuthGuard)
export class ModuleCatalogController {
  constructor(private readonly catalog: ModuleCatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Active modules, components and integrations' })
  list() {
    return this.catalog.findVisible();
  }
}
