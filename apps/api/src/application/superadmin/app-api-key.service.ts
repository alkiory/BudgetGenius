import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { AppApiKey } from '@domain/superadmin/app-api-key.entity';
import { CreateAppApiKeyDto } from './dto/app-api-key.dto';

/** Shown key shape: `bg_live_` + 48 hex chars (24 random bytes). */
const KEY_PREFIX = 'bg_live_';
const VISIBLE_PREFIX_LENGTH = KEY_PREFIX.length + 6;

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

/** Wire shape of a key row — the hash never leaves the server. */
export type AppApiKeyView = Omit<AppApiKey, 'hashedKey'>;

const toView = (row: AppApiKey): AppApiKeyView => ({
  id: row.id,
  name: row.name,
  prefix: row.prefix,
  scopes: row.scopes,
  lastUsedAt: row.lastUsedAt,
  revokedAt: row.revokedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

@Injectable()
export class AppApiKeyService {
  constructor(
    @InjectRepository(AppApiKey)
    private readonly repo: Repository<AppApiKey>,
  ) {}

  async findAll(): Promise<AppApiKeyView[]> {
    const rows = await this.repo.find({
      select: [
        'id',
        'name',
        'prefix',
        'scopes',
        'lastUsedAt',
        'revokedAt',
        'createdAt',
        'updatedAt',
      ],
      order: { createdAt: 'DESC' },
    });
    return rows;
  }

  /**
   * Issues a key. The plaintext secret is returned exactly once and only its
   * hash is persisted, so a leaked database dump is not a leaked credential.
   */
  async create(
    dto: CreateAppApiKeyDto,
  ): Promise<AppApiKeyView & { secret: string }> {
    const secret = `${KEY_PREFIX}${randomBytes(24).toString('hex')}`;
    const row = await this.repo.save(
      this.repo.create({
        name: dto.name.trim(),
        prefix: secret.slice(0, VISIBLE_PREFIX_LENGTH),
        hashedKey: sha256(secret),
        scopes: dto.scopes?.length ? dto.scopes : null,
      }),
    );
    return { ...toView(row), secret };
  }

  async revoke(id: number): Promise<AppApiKeyView> {
    const row = await this.findRow(id);
    if (!row.revokedAt) {
      row.revokedAt = new Date();
      await this.repo.save(row);
    }
    return toView(row);
  }

  async remove(id: number): Promise<{ deleted: true }> {
    await this.findRow(id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  private async findRow(id: number): Promise<AppApiKey> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`API key ${id} not found`);
    }
    return row;
  }
}
