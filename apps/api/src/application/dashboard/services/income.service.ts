import { IncomeRepository } from '@adapters/dashboard/persistence/income.repository';
import { Income } from '@domain/dashboard/income.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateIncomeDto } from '../dto/create-income.dto';
import { User } from '@domain/user/user.entity';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';

@Injectable()
export class IncomeService {
  constructor(
    private readonly repo: IncomeRepository,
    private readonly userRepo: UserRepositoryImpl,
  ) {}

  async createIncome(userId: number, dto: CreateIncomeDto): Promise<Income> {
    return await this.repo.create({
      ...dto,
      user: { id: userId } as User,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async getAllByUser({
    userId,
    offset,
    limit,
  }: {
    userId: number;
    offset: number;
    limit: number;
  }) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.incomes.length === 0) {
      return [];
    }

    const data = await this.repo.findAndCount({
      offset,
      limit,
    });

    return data;
  }

  async updateIncome(
    id: number,
    userId: number,
    dto: Partial<CreateIncomeDto>,
  ): Promise<Income> {
    return await this.repo.update(id, {
      ...dto,
      user: { id: userId } as User,
      updatedAt: new Date(),
    });
  }

  async deleteIncome(id: number, userId: number): Promise<void> {
    const ok = await this.repo.deleteIfOwned(id, userId);
    if (!ok) throw new NotFoundException('Income not found or not yours');
  }

  async deleteAllIncomes(userId: number): Promise<void> {
    await this.repo.deleteAll(userId);
  }
}
