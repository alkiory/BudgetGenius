import { Module } from '@nestjs/common';
import { SyncService } from '@application/sync/sync.service';
import { SyncController } from '@adapters/sync/http/sync.controller';

@Module({
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
