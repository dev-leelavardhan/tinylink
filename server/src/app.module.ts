import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from 'nestjs-pino';
import { pinoConfig } from './logger/pino.config';
import { HealthModule } from './health/health.module';
import { UrlsModule } from './urls/urls.module';
import { RedisModule } from './redis/redis.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
    }),
    LoggerModule.forRoot(pinoConfig),
    PrismaModule,

    //health
    HealthModule,

    //analytics (must be before UrlsModule so its routes take precedence)
    AnalyticsModule,

    //urls modules
    UrlsModule,

    //cache
    RedisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
