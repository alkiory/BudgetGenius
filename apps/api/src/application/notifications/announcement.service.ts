import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppNotification } from '@domain/superadmin/app-notification.entity';

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
  ) {}

  async findLiveForUser(userId: number): Promise<AppNotification[]> {
    // BudgetGenius is a single free product: `isPremium` is dormant and every
    // account is created as premium, so filtering by plan made the "free"
    // audience impossible to reach (and a premium-only notice unreachable if
    // the column ever flips). Announcements are delivered to every signed-in
    // account; the audience column stays for a future paid tier.
    return this.notifications
      .createQueryBuilder('n')
      .where('n.published = :published', { published: true })
      .andWhere('(n."publishedAt" IS NULL OR n."publishedAt" <= now())')
      .andWhere('(n."expiresAt" IS NULL OR n."expiresAt" > now())')
      .orderBy('n."publishedAt"', 'DESC')
      .limit(5)
      .getMany();
  }
}
