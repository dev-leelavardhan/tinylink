import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditRetentionQueue } from './audit-retention.queue';
import { AuditRetentionScheduler } from './audit-retention.scheduler';
import { AuditRetentionWorker } from './audit-retention.worker';

@Module({
  providers: [
    AuditService,
    AuditRetentionQueue,
    AuditRetentionScheduler,
    AuditRetentionWorker,
  ],
  exports: [AuditService],
})
export class AuditModule {}
