import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@domain/user/user.entity';
import { AppNotification } from '@domain/superadmin/app-notification.entity';
import { AnnouncementService } from '@application/notifications/announcement.service';
import { AnnouncementController } from '@adapters/notifications/http/announcement.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AppNotification, User])],
  controllers: [AnnouncementController],
  providers: [AnnouncementService],
})
export class NotificationsModule {}
