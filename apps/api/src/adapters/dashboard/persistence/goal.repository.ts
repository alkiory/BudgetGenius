import { Goal } from '@domain/dashboard/goal.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class GoalRepository {
  constructor(
    @InjectRepository(Goal)
    private readonly repo: Repository<Goal>,
  ) {}

  async countByUser(userId: number): Promise<number> {
    return this.repo.count({ where: { user: { id: userId } } });
  }

  async create(goal: Omit<Goal, 'id'>): Promise<Goal> {
    const data = this.repo.create(goal);
    return this.repo.save(data);
  }

  async save(goal: Goal): Promise<Goal> {
    return this.repo.save(goal);
  }

  async findByUser(userId: number): Promise<Goal[]> {
    return this.repo.find({ where: { user: { id: userId } } });
  }

  async findById(id: number): Promise<Goal[]> {
    return this.repo.find({ where: { id: id } });
  }

  async update(data: Partial<Goal>): Promise<Goal> {
    return this.repo.save(data);
  }

  async delete(id: number) {
    await this.repo.delete(id);
  }
}
