import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { AppCatalogService } from '@application/catalog/app-catalog.service';

/**
 * User-facing catalogue. Deliberately separate from `/superadmin/modules`,
 * which is the authoring surface: here every account only gets what its role
 * is allowed to see, and the response is the same inventory the sidebar and
 * the catalogue page render.
 */
@ApiTags('catalog')
@ApiBearerAuth()
@Controller('catalog')
@UseGuards(JwtAuthGuard)
export class AppCatalogController {
  constructor(private readonly catalog: AppCatalogService) {}

  @Get('entries')
  @ApiOperation({ summary: 'Catalogue entries visible to the signed-in user' })
  list(@Req() req) {
    return this.catalog.findVisibleFor(req.user?.role);
  }
}
