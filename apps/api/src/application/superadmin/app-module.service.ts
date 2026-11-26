import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AppModule,
  AppModuleBlock,
  AppModuleSection,
} from '@domain/superadmin/app-module.entity';
import { findPageBlockType, normalizePageBlockProps } from './page-blocks';
import {
  CreateAppModuleDto,
  ReorderAppModulesDto,
  UpdateAppModuleContentDto,
  UpdateAppModuleDto,
} from './dto/app-module.dto';

/** Empty values clear the relation instead of storing a dangling `""`. */
const normalizeParentKey = (value?: string | null): string | null => {
  const key = (value ?? '').trim().toLowerCase();
  return key || null;
};

/** Kinds that own a body the app renders (blocks, sections, components). */
const CONTENT_KINDS = ['module', 'page', 'tab', 'component'];

/** Stable, URL-safe id for a section the editor did not name. */
const slugify = (value: string, fallback: string): string => {
  const slug = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || fallback;
};

@Injectable()
export class AppModuleService {
  constructor(
    @InjectRepository(AppModule)
    private readonly repo: Repository<AppModule>,
  ) {}

  findAll(): Promise<AppModule[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async create(dto: CreateAppModuleDto): Promise<AppModule> {
    const key = dto.key.trim().toLowerCase();
    const existing = await this.repo.findOne({ where: { key } });
    if (existing) {
      throw new ConflictException(`A module with key "${key}" already exists`);
    }
    const parentKey = normalizeParentKey(dto.parentKey);
    if (parentKey && parentKey === key) {
      throw new BadRequestException('A module cannot belong to itself');
    }
    return this.repo.save(
      this.repo.create({
        ...dto,
        key,
        parentKey,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
      }),
    );
  }

  async update(id: number, dto: UpdateAppModuleDto): Promise<AppModule> {
    const module = await this.repo.findOne({ where: { id } });
    if (!module) {
      throw new NotFoundException(`Module ${id} not found`);
    }
    let renamedFrom: string | null = null;
    if (dto.key && dto.key.trim().toLowerCase() !== module.key) {
      const key = dto.key.trim().toLowerCase();
      const clash = await this.repo.findOne({ where: { key } });
      if (clash) {
        throw new ConflictException(
          `A module with key "${key}" already exists`,
        );
      }
      renamedFrom = module.key;
      module.key = key;
    }
    const parentKey =
      dto.parentKey === undefined
        ? module.parentKey
        : normalizeParentKey(dto.parentKey);
    if (parentKey && parentKey === module.key) {
      throw new BadRequestException('A module cannot belong to itself');
    }
    // A core module is always active: switching it off would break the app.
    if (module.isCore && dto.status === 'disabled') {
      throw new ConflictException('Core modules cannot be disabled');
    }
    Object.assign(module, {
      ...dto,
      key: module.key,
      parentKey,
      description:
        dto.description === undefined
          ? module.description
          : dto.description?.trim() || null,
    });
    const saved = await this.repo.save(module);
    // A rename would orphan every reference to the old key: children stop
    // showing under the module, and pages keep a placement `updateContent`
    // then rejects as unknown. Follow the rename everywhere in one request.
    if (renamedFrom) {
      await this.repo.update(
        { parentKey: renamedFrom },
        { parentKey: saved.key },
      );

      const pages = await this.repo.find();
      for (const page of pages) {
        const sections = page.content?.sections;
        if (!sections?.length) continue;

        let changed = false;
        const migrated = sections.map((section) => {
          if (!section.componentKeys?.includes(renamedFrom)) return section;
          changed = true;
          return {
            ...section,
            componentKeys: Array.from(
              new Set(
                section.componentKeys.map((key) =>
                  key === renamedFrom ? saved.key : key,
                ),
              ),
            ),
          };
        });

        if (changed) {
          page.content = { ...page.content!, sections: migrated };
          await this.repo.save(page);
        }
      }
    }
    return saved;
  }

  /**
   * Replaces the authored body of a page.
   *
   * Sections come ordered from the editor, so the array is the order. Blank
   * rows (the empty one an editor starts with) are dropped, ids are re-slugged
   * and de-duplicated, and component keys are checked against the inventory: a
   * section pointing at nothing would render an empty gap in the app.
   *
   * Blocks are the free-form UI the operator assembles without code: each one
   * is checked against `PAGE_BLOCK_TYPES` and its props are normalized to the
   * declared fields, so a stale or tampered payload cannot inject markup the
   * app would render.
   */
  async updateContent(
    id: number,
    dto: UpdateAppModuleContentDto,
  ): Promise<AppModule> {
    const module = await this.repo.findOne({ where: { id } });
    if (!module) {
      throw new NotFoundException(`Module ${id} not found`);
    }
    if (!CONTENT_KINDS.includes(module.kind)) {
      throw new BadRequestException(
        'Only modules, pages and tabs hold authored content',
      );
    }

    const usedIds = new Set<string>();
    const usedBlockIds = new Set<string>();
    const sections: AppModuleSection[] = [];
    const componentKeys = new Set<string>();

    dto.sections.forEach((raw, index) => {
      const title = (raw.title ?? '').trim();
      const body = (raw.body ?? '').trim();
      const keys = Array.from(
        new Set(
          (raw.componentKeys ?? [])
            .map((key) => key.trim().toLowerCase())
            .filter(Boolean),
        ),
      );

      const blocks: AppModuleBlock[] = (raw.blocks ?? []).map(
        (rawBlock, position) => {
          const type = rawBlock.type.trim().toLowerCase();
          const schema = findPageBlockType(type);
          if (!schema) {
            throw new BadRequestException(`Unknown block type: ${type}`);
          }
          const baseBlockId = slugify(
            rawBlock.id ?? type,
            `${type}-${position + 1}`,
          );
          let blockId = baseBlockId;
          let suffix = 2;
          while (usedBlockIds.has(blockId)) {
            blockId = `${baseBlockId}-${suffix}`;
            suffix += 1;
          }
          usedBlockIds.add(blockId);
          return {
            id: blockId,
            type,
            props: normalizePageBlockProps(schema, rawBlock.props),
          };
        },
      );

      // A row with nothing at all is the blank one an editor starts with.
      if (!title && !body && !blocks.length && !keys.length) return;

      const baseSectionId = slugify(raw.id ?? title, `section-${index + 1}`);
      let sectionId = baseSectionId;
      let suffix = 2;
      while (usedIds.has(sectionId)) {
        sectionId = `${baseSectionId}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(sectionId);
      keys.forEach((key) => componentKeys.add(key));

      sections.push({
        id: sectionId,
        title,
        body,
        blocks,
        componentKeys: keys,
      });
    });

    if (componentKeys.size) {
      const components = await this.repo.find({
        where: { key: In(Array.from(componentKeys)), kind: 'component' },
      });
      const found = new Set(components.map((component) => component.key));
      const missing = Array.from(componentKeys).filter(
        (key) => !found.has(key),
      );
      if (missing.length) {
        throw new BadRequestException(
          `Unknown components: ${missing.join(', ')}`,
        );
      }
    }

    module.content = { sections };
    return this.repo.save(module);
  }

  /**
   * Persists a new order for sibling entries (the tabs of one page).
   *
   * One request for the whole list: the app renders `sortOrder ASC`, so the
   * order of `keys` becomes the order of the page.
   */
  async reorder(dto: ReorderAppModulesDto): Promise<AppModule[]> {
    const keys = Array.from(
      new Set(dto.keys.map((key) => key.trim().toLowerCase()).filter(Boolean)),
    );
    if (!keys.length) return [];

    const rows = await this.repo.find({ where: { key: In(keys) } });
    const found = new Set(rows.map((row) => row.key));
    const missing = keys.filter((key) => !found.has(key));
    if (missing.length) {
      throw new NotFoundException(`Unknown modules: ${missing.join(', ')}`);
    }
    // Mixed parents would interleave orders between two different pages.
    if (new Set(rows.map((row) => row.parentKey)).size > 1) {
      throw new BadRequestException(
        'Only entries with the same parent can be reordered together',
      );
    }

    for (const [index, key] of keys.entries()) {
      await this.repo.update({ key }, { sortOrder: index });
    }
    return this.repo.find({
      where: { key: In(keys) },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Kept for future tooling only: the backoffice no longer deletes entries,
   * it disables them so the inventory and its history survive. If deletion is
   * exposed again it should cascade to children (`parentKey`) instead of
   * leaving them pointing at a missing module.
   */
  async remove(id: number): Promise<{ deleted: true }> {
    const module = await this.repo.findOne({ where: { id } });
    if (!module) {
      throw new NotFoundException(`Module ${id} not found`);
    }
    if (module.isCore) {
      throw new ConflictException('Core modules cannot be deleted');
    }
    await this.repo.delete(id);
    return { deleted: true };
  }
}
