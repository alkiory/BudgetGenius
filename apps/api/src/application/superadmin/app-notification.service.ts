import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppNotification } from '@domain/superadmin/app-notification.entity';
import {
  CreateAppNotificationDto,
  UpdateAppNotificationDto,
} from './dto/app-notification.dto';

@Injectable()
export class AppNotificationService {
  constructor(
    @InjectRepository(AppNotification)
    private readonly repo: Repository<AppNotification>,
  ) {}

  findAll(): Promise<AppNotification[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  create(dto: CreateAppNotificationDto): Promise<AppNotification> {
    const publishAt = dto.publishAt ? new Date(dto.publishAt) : null;
    // A scheduled announcement is already "published": the readers filter by
    // `publishedAt <= now()`, so it stays invisible until its moment arrives
    // without needing a scheduler process.
    const published = dto.published ?? Boolean(publishAt);
    return this.repo.save(
      this.repo.create({
        title: dto.title.trim(),
        body: dto.body.trim(),
        level: dto.level ?? 'info',
        audience: dto.audience ?? 'all',
        published,
        publishedAt: published ? publishAt ?? new Date() : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
    );
  }

  async update(
    id: number,
    dto: UpdateAppNotificationDto,
  ): Promise<AppNotification> {
    const notification = await this.findRow(id);
    // Rescheduling reuses the same window semantics as creation.
    if (dto.publishAt !== undefined) {
      notification.published = true;
      notification.publishedAt = dto.publishAt
        ? new Date(dto.publishAt)
        : new Date();
    }
    // Publishing stamps the date once; unpublishing clears it so a later
    // republish records the new send time instead of an old one. A
    // `publishAt` above wins over this branch.
    if (
      dto.publishAt === undefined &&
      dto.published !== undefined &&
      dto.published !== notification.published
    ) {
      notification.published = dto.published;
      notification.publishedAt = dto.published ? new Date() : null;
    }
    if (dto.title !== undefined) notification.title = dto.title.trim();
    if (dto.body !== undefined) notification.body = dto.body.trim();
    if (dto.level !== undefined) notification.level = dto.level;
    if (dto.audience !== undefined) notification.audience = dto.audience;
    if (dto.expiresAt !== undefined) {
      notification.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    return this.repo.save(notification);
  }

  async remove(id: number): Promise<{ deleted: true }> {
    await this.findRow(id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  private async findRow(id: number): Promise<AppNotification> {
    const notification = await this.repo.findOne({ where: { id } });
    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
    return notification;
  }
}
