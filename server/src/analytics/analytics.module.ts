import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsMapper } from './mappers/analytics.mapper';
import { AnalyticsQueue } from './queue/analytics.queue';
import { AnalyticsCleanupScheduler } from './queue/analytics-cleanup.scheduler';
import { AnalyticsRepository } from './repositories/analytics.repository';
import { AnalyticsService } from './service/analytics.service';
import { AnalyticsCleanupService } from './use-cases/analytics-cleanup.service';
import { AnalyticsClickService } from './use-cases/analytics-click.service';
import { AnalyticsReadService } from './use-cases/analytics-read.service';
import { AnalyticsWorker } from './worker/analytics.worker';

@Module({
  imports: [PrismaModule, RedisModule],

  controllers: [AnalyticsController],

  providers: [
    // Infrastructure
    AnalyticsQueue,
    AnalyticsWorker,
    AnalyticsCleanupScheduler,

    // Application
    AnalyticsService,
    AnalyticsReadService,
    AnalyticsClickService,
    AnalyticsCleanupService,

    // Persistence
    AnalyticsRepository,

    // Mapping
    AnalyticsMapper,
  ],

  exports: [AnalyticsService, AnalyticsQueue],
})
export class AnalyticsModule {}
