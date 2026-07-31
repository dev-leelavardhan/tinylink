import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { pinoConfig } from './logger/pino.config';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ThrottlerStorageModule } from './common/throttler/throttler-storage.module';
import { ThrottlerRedisStorage } from './common/throttler/throttler-redis-storage';

import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { UrlsModule } from './urls/urls.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath:
        process.env.NODE_ENV === 'test' ? '.env.test' : ['.env.local', '.env'],
      load: [configuration],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ThrottlerStorageModule],
      inject: [ThrottlerRedisStorage],
      useFactory: (storage: ThrottlerRedisStorage) => ({
        storage,
        throttlers: [
          {
            ttl: 60000,
            limit: 60,
          },
        ],
      }),
    }),
    LoggerModule.forRoot(pinoConfig),
    PrismaModule,
    RedisModule,

    // Feature modules (order matters for route precedence)
    HealthModule,
    MetricsModule,
    AnalyticsModule,
    UsersModule,
    UrlsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
