/**
 * Announcements are part of the single free product.
 *
 * `users.isPremium` is dormant (default true) and the product has no paid
 * tier, so filtering live announcements by the legacy plan column made the
 * "free" audience unreachable. The read side must deliver every published,
 * in-window announcement, regardless of that column.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnnouncementService } from '@application/notifications/announcement.service';
import { AppNotification } from '@domain/superadmin/app-notification.entity';

const buildService = async () => {
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
    ],
  }).compile();

  return {
    service: moduleRef.get(AnnouncementService),
    queryBuilder,
    andWhere,
  };
};

describe('AnnouncementService audience', () => {
  it('does not filter by the dormant premium flag', async () => {
    const { service, andWhere } = await buildService();

    await service.findLive();

    const filterCalls = andWhere.mock.calls.map(([sql]) => String(sql));
    expect(filterCalls.some((sql) => sql.includes('audience'))).toBe(false);
  });

  it('still applies the publish window and expiry', async () => {
    const { service, queryBuilder } = await buildService();

    await service.findLive();

    expect(queryBuilder.where).toHaveBeenCalledWith('n."published" = true');
    const filterCalls = queryBuilder.andWhere.mock.calls.map(([sql]) =>
      String(sql),
    );
    expect(
      filterCalls.some((sql) => sql.includes('"publishedAt" IS NULL')),
    ).toBe(true);
    expect(filterCalls.some((sql) => sql.includes('"expiresAt" IS NULL'))).toBe(
      true,
    );
  });
});
