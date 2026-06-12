import { Module } from '@nestjs/common';
import { AiService } from '@application/ai/ai.service';
import { AiController } from '@adapters/ai/http/ai.controller';
import { JwtStrategy } from '@infrastructure/config/strategy/jwt.strategy';
import { RedisService } from '@infrastructure/config/redis.service';
import { LoggingService } from '@infrastructure/log/logger.service';
import { UserModule } from '@infrastructure/user/user.module';

@Module({
  imports: [UserModule],
  controllers: [AiController],
  providers: [AiService, JwtStrategy, RedisService, LoggingService],
})
export class AiModule {}
