import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Transaction } from '@domain/dashboard/transaction.entity';

@Injectable()
export class OverviewRepository {
  constructor(private readonly ds: DataSource) {}

  async getExpensesByCategory(
    userId: number,
  ): Promise<{ name: string; value: number }[]> {
    return this.ds
      .getRepository(Transaction)
      .createQueryBuilder('tx')
      .select('tx.category', 'name')
      .addSelect('SUM(tx.amount)', 'value')
      .where('tx.userId = :userId', { userId })
      .andWhere('tx.amount < 0')
      .groupBy('tx.category')
      .getRawMany<{ name: string; value: string }>()
      .then((rows) =>
        rows.map((r) => ({ name: r.name, value: Math.abs(Number(r.value)) })),
      );
  }
}
