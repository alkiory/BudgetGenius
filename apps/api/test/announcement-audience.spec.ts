/**
 * Audience filtering for the announcements authored in the backoffice.
 *
 * The banner is the only user-facing surface, and it must never show a
 * premium-only notice to a free account (or the reverse). The service builds
 * the audience set from the signed-in user's `isPremium` flag and passes it to
 * the query, so this spec pins the exact set for each case instead of trusting
 * the SQL builder.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnnouncementService } from '@application/notifications/announcement.service';
import {
  AppNotification,
  AppNotificationAudience,
} from '@domain/superadmin/app-notification.entity';
import { User } from '@domain/user/user.entity';

const audienceForUser = async (
  isPremium: boolean,
): Promise<AppNotificationAudience[]> => {
  const andWhere = jest.fn().mockReturnThis();
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere,
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };

  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      AnnouncementService,
      {
        provide: getRepositoryToken(AppNotification),
        useValue: { createQueryBuilder: jest.fn(() => queryBuilder) },
      },
      {
        provide: getRepositoryToken(User),
        useValue: {
          findOne: jest.fn().mockResolvedValue({ id: 1, isPremium }),
        },
      },
    ],
  }).compile();

  await moduleRef.get(AnnouncementService).findLiveForUser(1);

  const audienceCall = andWhere.mock.calls.find(
    ([, params]) => params?.audiences !== undefined,
  );
  return (audienceCall?.[1] as { audiences: AppNotificationAudience[] })
    ?.audiences;
};

describe('AnnouncementService audience', () => {
  it('premium accounts see "all" and "premium" announcements', async () => {
    await expect(audienceForUser(true)).resolves.toEqual(["all", "premium"]);
  });

  it('free accounts see "all" and "free" announcements', async () => {
    await expect(audienceForUser(false)).resolves.toEqual(["all", "free"]);
  });
});
