import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { AnalyticsModule } from './analytics/analytics.module';
import { UrlsModule } from './urls/urls.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
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
    AnalyticsModule,
    UsersModule,
    UrlsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
