import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@domain/user/user.entity';
import {
  AppNotification,
  AppNotificationAudience,
} from '@domain/superadmin/app-notification.entity';

/**
 * Read side of the announcements authored in the backoffice.
 *
 * A row is live when it is published, its publish window has opened and it has
 * not expired yet. `publishedAt` doubles as the schedule: the backoffice can
 * publish it with a future timestamp and it will appear on the first poll after
 * that moment, with no cron job involved.
 */
@Injectable()
export class AnnouncementService {
  constructor(
    @InjectRepository(AppNotification)
    private readonly notifications: Repository<AppNotification>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async findLiveForUser(userId: number): Promise<AppNotification[]> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: ['id', 'isPremium'],
    });

    const audiences: AppNotificationAudience[] = user?.isPremium
      ? ['all', 'premium']
      : ['all', 'free'];

    return this.notifications
      .createQueryBuilder('n')
      .where('n.published = :published', { published: true })
      .andWhere('(n."publishedAt" IS NULL OR n."publishedAt" <= now())')
      .andWhere('(n."expiresAt" IS NULL OR n."expiresAt" > now())')
      .andWhere('n.audience IN (:...audiences)', { audiences })
      .orderBy('n."publishedAt"', 'DESC')
      .limit(5)
      .getMany();
  }
}
