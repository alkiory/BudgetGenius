import { SavingGoalRepository } from '@adapters/dashboard/persistence/saving-goal.repository';
import { SavingGoal } from '@domain/dashboard/saving-goal.entity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateSavingGoalDto,
  SavingGoalResponseDto,
} from '../dto/create-saving-goal.dto';
import { User } from '@domain/user/user.entity';
import { UpdateSavingGoalDto } from '../dto/update-saving-goal.dto';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';

@Injectable()
export class SavingGoalService {
  constructor(
    private readonly repo: SavingGoalRepository,
    private readonly userRepo: UserRepositoryImpl,
  ) {}

  async createSavingGoal(dto: CreateSavingGoalDto, userId: number) {
    if (dto.target === 0) {
      throw new BadRequestException(
        'Target amount must be greater than 0',
      );
    }

    if (dto.current > dto.target) {
      throw new BadRequestException(
        `Current amount ${dto.current} cannot be greater than target amount ${dto.target}`,
      );
    }

    const nameExists = await this.repo.nameExistsForUser(dto.name, userId);
    if (nameExists) {
      throw new ConflictException(
        `Saving goal with name "${dto.name}" already exists for this user`,
      );
    }

    const percentage = parseFloat(
      ((dto.current / dto.target) * 100).toFixed(2),
    );

    try {
      const newGoal = await this.repo.create({
        ...dto,
        percentage,
        user: { id: userId } as User,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        success: true,
        message: `🏁 Saving goal "${dto.name}" created successfully`,
        data: {
          id: newGoal.id,
          name: newGoal.name,
          target: newGoal.target,
          current: newGoal.current,
          percentage: newGoal.percentage,
          targetDate: newGoal.targetDate,
          category: newGoal.category,
          color: newGoal.color,
          createdAt: newGoal.createdAt,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to create saving goal');
    }
  }

  async updateSavingGoal(dto: UpdateSavingGoalDto, userId: number) {
    const savingGoal = await this.repo.findById(dto.id);
    if (!savingGoal) {
      throw new NotFoundException(`Saving goal with ID ${dto.id} not found`);
    }

    if (savingGoal.user.id !== userId) {
      throw new ForbiddenException(`You don't have access to this saving goal`);
    }

    if (dto.name && savingGoal.name !== dto.name) {
      const nameExists = await this.repo.nameExistsForUser(dto.name, userId);
      if (nameExists) {
        throw new ConflictException(
          `Saving goal with name "${dto.name}" already exists for this user`,
        );
      }
    }

    if (dto.current && dto.target) {
      if (dto.current > dto.target) {
        throw new BadRequestException(
          `Current amount ${dto.current} cannot be greater than target amount ${dto.target}`,
        );
      }
    }

    let needsPercentageUpdate = false;

    if (dto.target !== undefined && dto.target !== savingGoal.target) {
      needsPercentageUpdate = true;
    }

    if (dto.current !== undefined && dto.current !== savingGoal.current) {
      needsPercentageUpdate = true;
    }

    if (needsPercentageUpdate) {
      const target = dto.target !== undefined ? dto.target : savingGoal.target;
      const current =
        dto.current !== undefined ? dto.current : savingGoal.current;
      dto.percentage = parseFloat(((current / target) * 100).toFixed(2));
    }

    try {
      const updatedGoal = await this.repo.update({
        ...dto,
        updatedAt: new Date(),
      });
      return {
        message: '🏁 Saving goal updated successfully',
        savingGoal: updatedGoal,
      };
    } catch (error) {
      throw new InternalServerErrorException('Error updating saving goal');
    }
  }

  async findById(id: number, userId: number): Promise<SavingGoal | null> {
    const savingGoal = await this.repo.findById(id);
    const user = await this.repo.findByUser(userId);
    if (!savingGoal.id) {
      throw new NotFoundException(`Not found saving goal with ID ${id}`);
    }
    if (!user.savingGoals.find((sg) => sg.id === savingGoal.id)) {
      throw new NotFoundException(`This saving goal does not exist`);
    }
    if (user.savingGoals.find((sg) => sg.id === id)) {
      return savingGoal;
    }
  }
  async findByName(
    name: string,
    userId: number,
  ): Promise<SavingGoalResponseDto> {
    // 1. Buscar el saving goal con el usuario (solo ID)
    const savingGoal = await this.repo.findOne(name);

    if (!savingGoal) {
      throw new NotFoundException(`Saving goal with name "${name}" not found`);
    }

    // 2. Verificar pertenencia
    if (savingGoal.user.id !== userId) {
      throw new ForbiddenException(`You don't have access to this saving goal`);
    }

    // 3. Devolver DTO sin el user
    return {
      id: savingGoal.id,
      name: savingGoal.name,
      current: savingGoal.current,
      target: savingGoal.target,
      percentage: savingGoal.percentage,
      targetDate: savingGoal.targetDate,
      category: savingGoal.category,
      color: savingGoal.color,
    };
  }

  async findAll(userId: number): Promise<SavingGoal[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException(`Not found user with ID ${userId}`);
    }

    if (user.savingGoals.length === 0) {
      return [];
    }

    return user.savingGoals;
  }

  async deleteSavingGoal(id: number, userId: number): Promise<boolean> {
    const savingGoal = await this.repo.findById(id as number);

    if (savingGoal.user.id !== userId) {
      return false;
    }

    if (!savingGoal) {
      return false;
    }

    await this.repo.delete(id as number);
    return true;
  }

  async deleteAllSavingGoals(userId: number): Promise<void> {
    await this.repo.deleteAll(userId);
  }
}
