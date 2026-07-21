import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService
  extends Redis
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly appConfig: ConfigService) {
    super(appConfig.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
      enableReadyCheck: true,
      lazyConnect: true,
      keepAlive: 30000,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
      this.logger.log('Redis connected');
    } catch (err) {
      this.logger.error('Redis connection failed', err);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
  }
}
