import { BadRequestException, Injectable } from '@nestjs/common';
import { UserSettingsRepository } from '@adapters/user/persistence/user-settings.repository';
import { UserSettings } from '@domain/user/user-settings.entity';
import {
  UserSettingsDto,
  UserSettingsUpdateDto,
} from '@application/user/dto/settings.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@Injectable()
export class UserSettingsService {
  constructor(private readonly repo: UserSettingsRepository) {}

  async getOrCreateSettings(userId: number): Promise<UserSettingsDto> {
    let settings = await this.repo.findByUserId(userId);
    if (!settings) {
      settings = this.repo.create({
        user: { id: userId },
        timezone: 'UTC',
        currency: 'USD',
        locale: 'en-US',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserSettings);
      settings = await this.repo.save(settings);
    }
    return {
      id: settings.id,
      timezone: settings.timezone,
      currency: settings.currency,
      locale: settings.locale,
    } as UserSettingsDto;
  }

  async updateSettings(userId: number, data: UserSettingsUpdateDto) {
    const dto = plainToInstance(UserSettingsUpdateDto, data);
    const errors = await validate(dto);
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    let settings = await this.repo.findByUserId(userId);

    if (!settings) {
      settings = this.repo.create({
        user: { id: userId },
        updatedAt: new Date(),
      } as UserSettings);
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
