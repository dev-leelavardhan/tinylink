import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import {
  REDIS_CONSTANTS,
  REDIS_LOG_MESSAGES,
} from '../constants/redis.constants';

@Injectable()
export class RedisService
  extends Redis
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly appConfig: ConfigService) {
    super(appConfig.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: REDIS_CONSTANTS.MAX_RETRIES_PER_REQUEST,
      retryStrategy(times) {
        const delay = Math.min(
          times * REDIS_CONSTANTS.RETRY_BASE_DELAY_MS,
          REDIS_CONSTANTS.RETRY_MAX_DELAY_MS,
        );
        return delay;
      },
      enableReadyCheck: true,
      lazyConnect: true,
      keepAlive: REDIS_CONSTANTS.KEEPALIVE_INTERVAL_MS,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
      this.logger.log(REDIS_LOG_MESSAGES.CONNECTED);
    } catch (err) {
      this.logger.error(REDIS_LOG_MESSAGES.CONNECTION_FAILED, err);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
  }
}
