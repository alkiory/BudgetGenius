import { GoalRepository } from '@adapters/dashboard/persistence/goal.repository';
import { Goal } from '@domain/dashboard/goal.entity';
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateGoalDto, UpdateGoalDto } from '../dto/create-goal.dto';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';
import { User } from '@domain/user/user.entity';
import { LoggingService } from '@infrastructure/log/logger.service';

@Injectable()
export class GoalService {
  constructor(
    private readonly repo: GoalRepository,
    private readonly userRepo: UserRepositoryImpl,
    private readonly logger: LoggingService,
  ) {}

  private async validateUserAndGoal(
    userId: number,
    goalId: number,
  ): Promise<Goal> {
    const user = await this.userRepo.findById(userId);
    const goals = await this.repo.findById(goalId);

    const goal = goals.find((g) => g.id === goalId);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!goal) {
      throw new NotFoundException(`Goal with ID ${goalId} not found`);
    }

    if (goal.id !== goalId) {
      throw new ForbiddenException(`You may only access your own goals`);
    }

    return goal;
  }

  private validateDates(startDate: Date, dueDate: Date): void {
    if (startDate > dueDate) {
      throw new BadRequestException('Start date must be before due date');
    }
  }

  async createGoal(userId: number, dto: CreateGoalDto): Promise<Goal> {
    this.validateDates(dto.startDate, dto.dueDate);

    const existingCount = await this.repo.countByUser(userId);

    const user = await this.userRepo.findById(userId);
    if (!user.isPremium && existingCount >= 3) {
      this.logger.warn(
        `User ${userId} attempted to create a 4th goal while free`,
      );
      throw new ForbiddenException(
        'Free users may only create up to 3 goals.  Upgrade to premium to add more.',
      );
    }

    return this.repo.create({
      ...dto,
      user: { id: userId } as User,
      currentAmount: dto.currentAmount ?? 0,
      status: dto.status ?? 'active',
      description: dto.description ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async list(userId: number): Promise<Goal[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.goals.length === 0) {
      return [];
    }

    return this.repo.findByUser(userId);
  }

  async getGoal(userId: number, id: number): Promise<Goal> {
    return this.validateUserAndGoal(userId, id);
  }

  async updateGoal(
    userId: number,
    id: number,
    dto: UpdateGoalDto,
  ): Promise<Goal> {
    if (dto.startDate && dto.dueDate) {
      this.validateDates(dto.startDate, dto.dueDate);
    } else if (dto.startDate || dto.dueDate) {
      // Si solo se actualiza una fecha, necesitamos obtener la otra de la meta existente
      const existingGoal = await this.repo.findById(id);

      const currentGoal = existingGoal.find((g) => g.id === id);
      const startDate = dto.startDate ?? currentGoal.startDate;
      const dueDate = dto.dueDate ?? currentGoal.dueDate;
      this.validateDates(startDate, dueDate);
    }

    return this.repo.update({
      ...dto,
      updatedAt: new Date(),
    });
  }

  async updateGoalProgress(
    userId: number,
    goalId: number,
    amount: number,
  ): Promise<Goal> {
    const goal = await this.validateUserAndGoal(userId, goalId);

    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (amount > goal.targetAmount) {
      throw new BadRequestException(
        `Amount ${amount} cannot be greater than target amount ${goal.targetAmount}`,
      );
    }

    if (goal.status === 'completed') {
      throw new BadRequestException('Goal is already completed');
    }

    goal.currentAmount += amount;
    goal.status =
      goal.currentAmount >= goal.targetAmount ? 'completed' : 'active';

    return this.repo.save(goal);
  }

  async removeGoal(userId: number, id: number): Promise<void> {
    await this.validateUserAndGoal(userId, id);
    return this.repo.delete(id);
  }
}
