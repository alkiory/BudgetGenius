import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PasswordResetToken } from '@domain/auth/password-reset.entity';

@Injectable()
export class PasswordResetRepository {
  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly repo: Repository<PasswordResetToken>,
  ) {}

  async saveToken(email: string, token: string): Promise<PasswordResetToken> {
    const resetToken = this.repo.create({ email, token });
    return this.repo.save(resetToken);
  }

  async findToken(token: string): Promise<PasswordResetToken | null> {
    return this.repo.findOne({ where: { token } });
  }

  async deleteToken(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
