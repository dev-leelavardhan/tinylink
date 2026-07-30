import { Module } from '@nestjs/common';
import { ThrottlerRedisStorage } from './throttler-redis-storage';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [ThrottlerRedisStorage],
  exports: [ThrottlerRedisStorage],
})
export class ThrottlerStorageModule {}
