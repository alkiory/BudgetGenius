import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@domain/user/user.entity';
import { UserController } from '@adapters/user/http/user.controller';
import { UserService } from '@application/user/user.service';
import { LoggingService } from '@infrastructure/log/logger.service';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService, UserRepositoryImpl, LoggingService],
  exports: [UserService, UserRepositoryImpl],
})
export class UserModule {}
