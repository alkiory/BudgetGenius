import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { UserSettingsRepository } from '@adapters/user/persistence/user-settings.repository';
import {
  SupportedCurrency,
  UserSettings,
} from '@domain/user/user-settings.entity';
import {
  UserSettingsDto,
  UserSettingsUpdateDto,
} from '@application/user/dto/settings.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * Fallback currency for every money surface when no usable value is
 * stored on the profile (legacy row created before the enum, or a row
 * created by a partial PATCH). Mirrors the app-wide default shown by
 * the onboarding wizard ("Euro (€)").
 */
const DEFAULT_CURRENCY: SupportedCurrency = 'EUR';

/**
 * D1: stable, client-mappable message for the currency lock. A stored amount
 * has no unit of its own, so changing the profile currency after money exists
 * would re-label history instead of converting it (1.000 EUR would suddenly
 * read as 1.000 USD). Clients can match this string to show a translated
 * explanation; changing it is a breaking change.
 */
export const CURRENCY_LOCKED_HAS_HISTORY =
  'Currency cannot be changed once the account has transactions or budgets';

@Injectable()
export class UserSettingsService {
  constructor(private readonly repo: UserSettingsRepository) {}

  async getOrCreateSettings(userId: number): Promise<UserSettingsDto> {
    let settings = await this.repo.findByUserId(userId);
    if (!settings) {
      settings = this.repo.create({
        user: { id: userId },
        timezone: 'UTC',
        // Euro-only app: new settings rows default to EUR.
        currency: DEFAULT_CURRENCY,
        locale: 'en-US',
        // Android APK audit, 2026-06: new rows start in the
        // pre-onboarding state. The migration's `DEFAULT FALSE`
        // also covers this on the SQL boundary, but stating it
        // explicitly here keeps the row shape consistent with the
        // front-end UserSettings type.
        hasCompletedOnboarding: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserSettings);
      settings = await this.repo.save(settings);
    }
    return {
      id: settings.id,
      timezone: settings.timezone,
      // Fallback to EUR so every downstream consumer (transactions,
      // budgets, dashboard, exports) always receives a usable value
      // instead of `undefined` from a legacy row.
      currency: settings.currency ?? DEFAULT_CURRENCY,
      locale: settings.locale,
      // Default to `false` defensively: legacy rows from before
      // migration 1800000000005 (column added) didn't have the
      // field, and TypeORM's plain row hydration returns
      // `undefined` rather than the SQL DEFAULT. Frontend treats
      // `undefined` and `false` identically.
      hasCompletedOnboarding: settings.hasCompletedOnboarding ?? false,
    } as UserSettingsDto;
  }

  /**
   * Currency every downstream money operation must read from: the
   * user's saved profile currency, falling back to EUR when the row
   * has no usable value. Used by the services that stamp or format
   * amounts server-side (budgets, report exports).
   */
  async getCurrencyForUser(userId: number): Promise<SupportedCurrency> {
    const settings = await this.getOrCreateSettings(userId);
    return (settings?.currency as SupportedCurrency) ?? DEFAULT_CURRENCY;
  }

  async updateSettings(userId: number, data: UserSettingsUpdateDto) {
    const dto = plainToInstance(UserSettingsUpdateDto, data);
    const errors = await validate(dto);
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    let settings = await this.repo.findByUserId(userId);

    if (!settings) {
      // First write for this user (e.g. a PATCH that only carries
      // `locale`). Seed the NOT NULL columns with the documented
      // defaults before applying the patch — otherwise the insert hits
      // the DB with no `currency`/`timezone`/`locale` and fails.
      settings = this.repo.create({
        user: { id: userId },
        timezone: 'UTC',
        currency: DEFAULT_CURRENCY,
        locale: 'en-US',
        hasCompletedOnboarding: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserSettings);
    }

    // D1 guard: only an account without money can change its currency.
    // Re-sending the current value stays allowed (onboarding wizards PATCH
    // the whole settings object), so the check compares before counting.
    //
    // Check-then-write window: a transaction inserted between the count and
    // the save still slips through. Closing it would need a lock shared by
    // every financial write; the exposure is one racing PATCH and the next
    // write is the only thing affected, so it is documented and accepted.
    if (dto.currency && dto.currency !== settings.currency) {
      const history = await this.repo.countFinancialHistory(userId);
      if (history > 0) {
        throw new ConflictException(CURRENCY_LOCKED_HAS_HISTORY);
      }
    }

    // Use patch approach to update only the specified properties
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined) {
        settings[key] = data[key];
      }
    });

    return this.repo.save(settings);
  }
}
