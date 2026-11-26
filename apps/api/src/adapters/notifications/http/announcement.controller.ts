import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { AnnouncementService } from '@application/notifications/announcement.service';

/**
 * User-facing announcements. Deliberately separate from
 * `/superadmin/notifications`, which is the authoring surface and only answers
 * to the superadmin role.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class AnnouncementController {
  constructor(private readonly announcements: AnnouncementService) {}

  @Get()
  @ApiOperation({ summary: 'Live announcements for the signed-in user' })
  list(@Req() req) {
    return this.announcements.findLiveForUser(req.user.userId);
  }
}
