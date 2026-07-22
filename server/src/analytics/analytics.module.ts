import { Module } from '@nestjs/common';
import { AnalyticsQueue } from './queue/analytics.queue';
import { AnalyticsCleanupScheduler } from './queue/analytics-cleanup.scheduler';
import { AnalyticsWorker } from './worker/analytics.worker';
import { AnalyticsService } from './service/analytics.service';
import { AnalyticsReadService } from './use-cases/analytics-read.service';
import { AnalyticsClickService } from './use-cases/analytics-click.service';
import { AnalyticsCleanupService } from './use-cases/analytics-cleanup.service';
import { AnalyticsRepository } from './repositories/analytics.repository';
import { AnalyticsMapper } from './mappers/analytics.mapper';
import { AnalyticsController } from './controllers/analytics.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsQueue,
    AnalyticsCleanupScheduler,
    AnalyticsWorker,
    AnalyticsService,
    AnalyticsReadService,
    AnalyticsClickService,
    AnalyticsCleanupService,
    AnalyticsRepository,
    AnalyticsMapper,
  ],
  exports: [AnalyticsQueue, AnalyticsService],
})
export class AnalyticsModule {}
