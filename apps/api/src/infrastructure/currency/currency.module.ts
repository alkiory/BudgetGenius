import { Module } from '@nestjs/common';

import { RedisService } from '@infrastructure/config/redis.service';
import { LoggingService } from '@infrastructure/log/logger.service';

import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';

@Module({
  providers: [CurrencyService, RedisService, LoggingService],
  controllers: [CurrencyController],
  exports: [CurrencyService],
})
export class CurrencyModule { }
