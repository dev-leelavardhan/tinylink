import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { CacheService } from './service/cache.service';

@Module({
  imports: [RedisModule],

  providers: [CacheService],

  exports: [CacheService],
})
export class CacheModule {}
