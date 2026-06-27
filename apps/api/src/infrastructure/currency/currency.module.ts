import { Module } from '@nestjs/common';

import { RedisService } from '@infrastructure/config/redis.service';

import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';

@Module({
  providers: [CurrencyService, RedisService],
  controllers: [CurrencyController],
  exports: [CurrencyService],
})
export class CurrencyModule { }
