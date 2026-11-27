import { Module } from '@nestjs/common';
import { SyncService } from '@application/sync/sync.service';
import { SyncController } from '@adapters/sync/http/sync.controller';
import { RedisService } from '@infrastructure/config/redis.service';

@Module({
  controllers: [SyncController],
  providers: [SyncService, RedisService],
})
export class SyncModule {}
