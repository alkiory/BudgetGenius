import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppProviderKey } from '@domain/superadmin/app-provider-key.entity';
import {
  CreateAppProviderKeyDto,
  UpdateAppProviderKeyDto,
} from './dto/app-provider-key.dto';
import {
  lastFour,
  openSecret,
  sealSecret,
} from '@infrastructure/crypto/secret-box';

/** Wire shape: the sealed value is replaced by the readable key. */
export type AppProviderKeyView = Omit<AppProviderKey, 'encryptedKey'> & {
  key: string | null;
};

export interface ResolvedProviderKey {
  id: number | null;
  key: string;
}

const toView = (row: AppProviderKey): AppProviderKeyView => {
  const { encryptedKey, ...rest } = row;
  return { ...rest, key: openSecret(encryptedKey) };
};

@Injectable()
export class AppProviderKeyService {
  constructor(
    @InjectRepository(AppProviderKey)
    private readonly repo: Repository<AppProviderKey>,
  ) {}

  async findAll(): Promise<AppProviderKeyView[]> {
    const rows = await this.repo.find({
      order: { priority: 'ASC', createdAt: 'ASC' },
    });
    return rows.map(toView);
  }

  async create(dto: CreateAppProviderKeyDto): Promise<AppProviderKeyView> {
    const key = dto.key.trim();
    const row = await this.repo.save(
      this.repo.create({
        label: dto.label.trim(),
        provider: dto.provider?.trim() || 'openai',
        encryptedKey: sealSecret(key),
        lastFour: lastFour(key),
        isActive: dto.isActive ?? true,
        priority: dto.priority ?? 0,
      }),
    );
    return toView(row);
  }

  async update(
    id: number,
    dto: UpdateAppProviderKeyDto,
  ): Promise<AppProviderKeyView> {
    const row = await this.findRow(id);
    if (dto.label !== undefined) row.label = dto.label.trim();
    if (dto.provider !== undefined) row.provider = dto.provider.trim();
    if (dto.priority !== undefined) row.priority = dto.priority;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.key !== undefined) {
      const key = dto.key.trim();
      row.encryptedKey = sealSecret(key);
      row.lastFour = lastFour(key);
      // A replaced credential starts with a clean health record.
      row.lastError = null;
      row.lastFailedAt = null;
    }
    return toView(await this.repo.save(row));
  }

  async remove(id: number): Promise<{ deleted: true }> {
    await this.findRow(id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  /**
   * Active credentials in failover order. Undecryptable rows are skipped (they
   * were sealed with a rotated secret) so one stale row cannot break Finny.
   */
  async resolveActive(): Promise<ResolvedProviderKey[]> {
    const rows = await this.repo.find({
      where: { isActive: true },
      order: { priority: 'ASC', createdAt: 'ASC' },
    });
    const resolved: ResolvedProviderKey[] = [];
    for (const row of rows) {
      const key = openSecret(row.encryptedKey);
      if (key) resolved.push({ id: row.id, key });
    }
    return resolved;
  }

  async markUsed(id: number): Promise<void> {
    await this.repo.update(id, { lastUsedAt: new Date(), lastError: null });
  }

  async markFailed(id: number, error: string): Promise<void> {
    await this.repo.update(id, {
      lastFailedAt: new Date(),
      lastError: error.slice(0, 240),
    });
  }

  private async findRow(id: number): Promise<AppProviderKey> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Provider key ${id} not found`);
    }
    return row;
  }
}
