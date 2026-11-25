import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@infrastructure/auth/guards/roles.guard';
import { Roles } from '@infrastructure/auth/decorators/roles.decorator';
import { UserRole } from '@domain/user/user.entity';
import { AppNotification } from '@domain/superadmin/app-notification.entity';
import { AppNotificationService } from '@application/superadmin/app-notification.service';
import {
  CreateAppNotificationDto,
  UpdateAppNotificationDto,
} from '@application/superadmin/dto/app-notification.dto';

@ApiTags('superadmin')
@ApiBearerAuth()
@Controller('superadmin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class AppNotificationController {
  constructor(private readonly notifications: AppNotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List announcements, newest first' })
  @ApiResponse({ status: 200, type: [AppNotification] })
  list() {
    return this.notifications.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create an announcement (optionally published)' })
  create(@Body() dto: CreateAppNotificationDto) {
    return this.notifications.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Edit or publish/unpublish an announcement' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppNotificationDto,
  ) {
    return this.notifications.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an announcement' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.notifications.remove(id);
  }
}
