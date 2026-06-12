import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from '@domain/user/user-settings.entity';

@Injectable()
export class UserSettingsRepository {
  constructor(
    @InjectRepository(UserSettings)
    private repo: Repository<UserSettings>,
  ) {}

  findByUserId(userId: number) {
    return this.repo.findOne({ where: { user: { id: userId } } });
  }

  create(settings: Partial<UserSettings>) {
    return this.repo.create(settings);
  }

  save(settings: UserSettings) {
    return this.repo.save(settings);
  }
}
