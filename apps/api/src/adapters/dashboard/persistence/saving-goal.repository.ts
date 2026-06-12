import { SavingGoal } from '@domain/dashboard/saving-goal.entity';
import { User } from '@domain/user/user.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class SavingGoalRepository {
  constructor(
    @InjectRepository(SavingGoal)
    private readonly repo: Repository<SavingGoal>,
  ) {}

  async create(savingGoal: Partial<SavingGoal>): Promise<SavingGoal> {
    const newSavingGoal = this.repo.create(savingGoal);
    return this.repo.save(newSavingGoal);
  }

  async findAll(): Promise<SavingGoal[]> {
    return this.repo.find();
  }

  async findById(id: number): Promise<SavingGoal> {
    const savingGoal = await this.repo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!savingGoal) {
      throw new NotFoundException(
        `Not found saving goal with ID ${id} or already deleted`,
      );
    }
    return savingGoal;
  }
  async findOne(name: string): Promise<SavingGoal> {
    const savingGoal = await this.repo.findOne({
      where: { name },
      relations: ['user'],
    });
    if (!savingGoal) {
      throw new NotFoundException(`Not found saving goal with name ${name}`);
    }
    return savingGoal;
  }

  async findByUser(userId: number): Promise<User> {
    const userRepo = this.repo.manager.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: userId },
      relations: ['savingGoals'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  async nameExistsForUser(name: string, userId: number): Promise<boolean> {
    const count = await this.repo.count({
      where: { name, user: { id: userId } },
    });
    return count > 0;
  }

  async update(updateData: Partial<SavingGoal>): Promise<SavingGoal> {
    const savingGoal = await this.repo.findOne({
      where: { id: updateData.id },
    });

    if (!savingGoal) {
      throw new NotFoundException(
        `Not found saving goal with ID ${updateData.id}`,
      );
    }

    Object.assign(savingGoal, updateData);
    return this.repo.save(savingGoal);
  }
  async updatePercentage(id: number, percentage: number): Promise<SavingGoal> {
    const savingGoal = await this.repo.findOne({ where: { id } });

    if (!savingGoal) {
      throw new Error(`No se encontró una meta de ahorro con el ID ${id}`);
    }

    savingGoal.percentage = percentage;
    return this.repo.save(savingGoal);
  }
  async updateCurrent(id: number, current: number): Promise<SavingGoal> {
    const savingGoal = await this.repo.findOne({ where: { id } });
    if (!savingGoal) {
      throw new Error(`No se encontró una meta de ahorro con el ID ${id}`);
    }
    savingGoal.current = current;
    return this.repo.save(savingGoal);
  }
  async updateTarget(id: number, target: number): Promise<SavingGoal> {
    const savingGoal = await this.repo.findOne({ where: { id } });
    if (!savingGoal) {
      throw new Error(`No se encontró una meta de ahorro con el ID ${id}`);
    }
    savingGoal.target = target;
    return this.repo.save(savingGoal);
  }
  async updateName(id: number, name: string): Promise<SavingGoal> {
    const savingGoal = await this.repo.findOne({ where: { id } });
    if (!savingGoal) {
      throw new Error(`No se encontró una meta de ahorro con el ID ${id}`);
    }
    savingGoal.name = name;
    return this.repo.save(savingGoal);
  }
  async delete(id: number): Promise<{ message: string }> {
    await this.repo.delete(id);
    return {
      message: `Saving goal with ID ${id} deleted successfully`,
    };
  }

  async deleteAll(userId: number): Promise<void> {
    const deletedSg = await this.repo.delete({ user: { id: userId } });
    if (deletedSg.affected === 0) {
      throw new NotFoundException(`No saving goals found.`);
    }
  }
}
