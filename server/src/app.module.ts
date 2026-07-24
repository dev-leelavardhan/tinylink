import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { pinoConfig } from './logger/pino.config';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

import { HealthModule } from './health/health.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { UrlsModule } from './urls/urls.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
    }),
    LoggerModule.forRoot(pinoConfig),
    PrismaModule,
    RedisModule,

    // Feature modules (order matters for route precedence)
    HealthModule,
    AnalyticsModule,
    UrlsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
