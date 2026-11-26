import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import {
  AppModule,
  AppModuleKind,
} from '@domain/superadmin/app-module.entity';

export interface CatalogItem {
  id: number;
  key: string;
  name: string;
  description: string | null;
  kind: AppModuleKind;
  category: string;
  status: 'active' | 'beta';
  version: string;
  /** Key of the parent module for a component, `null` when standalone. */
  parentKey: string | null;
}

/**
 * What the app shows under "Módulos".
 *
 * Only non-disabled rows are exposed: switching a module off in the backoffice
 * removes it from this list on the next client poll. `isCore` is enforced on
 * the write side, so a core module is always here.
 */
@Injectable()
export class ModuleCatalogService {
  constructor(
    @InjectRepository(AppModule)
    private readonly modules: Repository<AppModule>,
  ) {}

  async findVisible(): Promise<CatalogItem[]> {
    const rows = await this.modules.find({
      where: { status: Not('disabled') },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      kind: row.kind,
      category: row.category,
      status: row.status === 'beta' ? 'beta' : 'active',
      version: row.version,
      parentKey: row.parentKey ?? null,
    }));
  }
}
