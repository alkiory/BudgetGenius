import { Module } from '@nestjs/common';
import { AiService } from '@application/ai/ai.service';
import { AiController } from '@adapters/ai/http/ai.controller';
import { JwtStrategy } from '@infrastructure/config/strategy/jwt.strategy';
import { RedisService } from '@infrastructure/config/redis.service';
import { TokenEpochService } from '@application/auth/token-epoch.service';
import { LoggingService } from '@infrastructure/log/logger.service';
import { UserModule } from '@infrastructure/user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppProviderKey } from '@domain/superadmin/app-provider-key.entity';

@Module({
  imports: [UserModule, TypeOrmModule.forFeature([AppProviderKey])],
  controllers: [AiController],
  providers: [
    AiService,
    JwtStrategy,
    RedisService,
    TokenEpochService,
    LoggingService,
  ],
  exports: [AiService],
})
export class AiModule {}
