import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { SyncService } from '@application/sync/sync.service';

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get('revision')
  @ApiOperation({
    summary: 'Cheap revision of the account data, polled by clients',
  })
  revision(@Req() req) {
    return this.sync.getRevision(req.user.userId);
  }
}
