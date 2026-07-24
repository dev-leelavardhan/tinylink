import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/service/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check() {
    const result: Record<string, string> = {};

    // Check PostgreSQL
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      result.db = 'up';
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        db: 'down',
        redis: result.redis ?? 'unknown',
      });
    }

    // Check Redis
    try {
      const pong = await this.redis.ping();
      result.redis = pong === 'PONG' ? 'up' : 'degraded';
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        db: result.db,
        redis: 'down',
      });
    }

    return {
      status: 'ok',
      ...result,
    };
  }
}
