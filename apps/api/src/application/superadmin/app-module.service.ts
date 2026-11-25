import {
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
    return this.repo.save(
      this.repo.create({
        ...dto,
        key,
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
    if (dto.key && dto.key.trim().toLowerCase() !== module.key) {
      const key = dto.key.trim().toLowerCase();
      const clash = await this.repo.findOne({ where: { key } });
      if (clash) {
        throw new ConflictException(`A module with key "${key}" already exists`);
      }
      module.key = key;
    }
    // A core module is always active: switching it off would break the app.
    if (module.isCore && dto.status === 'disabled') {
      throw new ConflictException('Core modules cannot be disabled');
    }
    Object.assign(module, {
      ...dto,
      key: module.key,
      description:
        dto.description === undefined
          ? module.description
          : dto.description?.trim() || null,
    });
    return this.repo.save(module);
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
