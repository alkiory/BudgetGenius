import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '@domain/superadmin/app-module.entity';
import {
  CreateAppModuleDto,
  UpdateAppModuleDto,
} from './dto/app-module.dto';

/** Empty values clear the relation instead of storing a dangling `""`. */
const normalizeParentKey = (value?: string | null): string | null => {
  const key = (value ?? '').trim().toLowerCase();
  return key || null;
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
        throw new ConflictException(`A module with key "${key}" already exists`);
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
    // A rename would orphan the components pointing at the old key, so the
    // children follow the module instead of disappearing from its detail.
    if (renamedFrom) {
      await this.repo.update({ parentKey: renamedFrom }, { parentKey: saved.key });
    }
    return saved;
  }

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
