import { Income } from '@domain/dashboard/income.entity';
import { User } from '@domain/user/user.entity';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class IncomeRepository {
  constructor(
    @InjectRepository(Income)
    private readonly repo: Repository<Income>,
  ) {}

  create(income: Omit<Income, 'id'>): Promise<Income> {
    const ent = this.repo.create(income);
    return this.repo.save(ent);
  }

  async findByUser(userId: number): Promise<User> {
    const userRepo = this.repo.manager.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: userId },
      relations: ['incomes'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  async update(id: number, income: Partial<Income>): Promise<Income> {
    await this.repo.update(id, income);
    return this.repo.findOne({ where: { id } });
  }

  async deleteIfOwned(id: number, userId: number): Promise<boolean> {
    const inc = await this.repo.findOne({
      where: { id, user: { id: userId } },
    });
    if (!inc) return false;
    await this.repo.delete(id);
    return true;
  }

  async deleteAll(userId: number) {
    try {
      const user = await this.findByUser(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (user.incomes.length === 0) {
        return { message: 'No incomes found for this user' };
      }
      const incomes = user.incomes;
      await this.repo.remove(incomes);
    } catch (error) {
      console.error('Error deleting incomes:', error);
      throw new InternalServerErrorException('Error deleting incomes');
    }
  }

  async findAndCount({ offset, limit }: { offset: number; limit: number }) {
    const [incomes, total] = await this.repo.findAndCount({
      skip: offset,
      take: limit,
      order: {
        date: 'DESC',
      },
    });
    return {
      incomes,
      meta: {
        total,
        offset,
        limit,
        nextOffset: offset + limit < total ? offset + limit : null,
      },
    };
  }
}
