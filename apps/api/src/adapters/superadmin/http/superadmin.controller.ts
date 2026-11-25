import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@infrastructure/auth/guards/roles.guard';
import { Roles } from '@infrastructure/auth/decorators/roles.decorator';
import { UserRole } from '@domain/user/user.entity';
import { SuperAdminOverviewService } from '@application/superadmin/superadmin-overview.service';

/**
 * Backoffice root: aggregate usage of the product.
 *
 * Every route in this module is gated by `JwtAuthGuard` + `RolesGuard` with
 * `@Roles(superadmin)`. `admin` is intentionally NOT enough: the backoffice
 * administers the app, not individual accounts.
 */
@ApiTags('superadmin')
@ApiBearerAuth()
@Controller('superadmin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class SuperAdminController {
  constructor(private readonly overview: SuperAdminOverviewService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Aggregate usage metrics for the backoffice' })
  getOverview() {
    return this.overview.getOverview();
  }
}
