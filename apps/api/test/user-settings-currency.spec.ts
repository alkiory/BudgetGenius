import { BadRequestException } from '@nestjs/common';
import { UserSettingsService } from '@application/user/user-settings.service';
import { UserSettingsRepository } from '@adapters/user/persistence/user-settings.repository';
import { UserSettings } from '@domain/user/user-settings.entity';

/**
 * The onboarding wizard PATCHes `/user-settings` with `timezone`,
 * `currency` and `locale` in one call. Currency is the field the
 * dashboard, transactions, budgets and report exports read back, so
 * this pins that the chosen value is actually written to the profile
 * row (and that an unsupported code is rejected before it reaches the
 * Postgres enum).
 */
const makeRepo = (initial?: UserSettings) => {
  let stored: UserSettings | undefined = initial
    ? { ...initial }
    : undefined;

  return {
    findByUserId: jest.fn(async () => stored),
    create: jest.fn((settings: Partial<UserSettings>) =>
      ({ ...settings }) as UserSettings,
    ),
    save: jest.fn(async (settings: UserSettings) => {
      stored = settings;
      return settings;
    }),
    getStored: () => stored,
  };
};

const existingRow: UserSettings = {
  id: 7,
  timezone: 'UTC',
  currency: 'EUR',
  locale: 'en-US',
  hasCompletedOnboarding: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: 1 } as UserSettings['user'],
};

const buildService = (repo: ReturnType<typeof makeRepo>) =>
  new UserSettingsService(repo as unknown as UserSettingsRepository);

describe('UserSettingsService — onboarding currency', () => {
  it('persists the currency chosen on the onboarding wizard', async () => {
    const repo = makeRepo(existingRow);
    const service = buildService(repo);

    const saved = await service.updateSettings(1, {
      timezone: 'America/Bogota',
      currency: 'COP',
      locale: 'es-CO',
      hasCompletedOnboarding: true,
    });

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(saved.currency).toBe('COP');
    expect(saved.timezone).toBe('America/Bogota');
    expect(saved.locale).toBe('es-CO');
    expect(saved.hasCompletedOnboarding).toBe(true);

    // Reading the profile back (what every money surface does) returns
    // the same choice.
    const settings = await service.getOrCreateSettings(1);
    expect(settings.currency).toBe('COP');
    await expect(service.getCurrencyForUser(1)).resolves.toBe('COP');
  });

  it('seeds a first-time row with the chosen currency instead of the EUR default', async () => {
    const repo = makeRepo(undefined);
    const service = buildService(repo);

    const saved = await service.updateSettings(1, {
      currency: 'USD',
      hasCompletedOnboarding: true,
    });

    expect(saved.currency).toBe('USD');
    // NOT NULL columns still get their documented defaults.
    expect(saved.timezone).toBe('UTC');
    expect(saved.locale).toBe('en-US');
  });

  it('rejects a currency outside the supported enum with a 400', async () => {
    const repo = makeRepo(existingRow);
    const service = buildService(repo);

    await expect(
      service.updateSettings(1, { currency: 'GBP' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.getStored()?.currency).toBe('EUR');
  });
});
