import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/service/redis.service';

const HEALTH_CHECK_TIMEOUT_MS = 5_000;

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check() {
    const [dbResult, redisResult] = await Promise.allSettled([
      this.checkDb(),
      this.checkRedis(),
    ]);

    const db = dbResult.status === 'fulfilled' ? dbResult.value : 'down';
    const redis =
      redisResult.status === 'fulfilled' ? redisResult.value : 'down';

    if (db === 'down' || redis === 'down') {
      throw new ServiceUnavailableException({
        status: 'error',
        db,
        redis,
      });
    }

    return { status: 'ok', db, redis };
  }

  private async checkDb(): Promise<string> {
    return Promise.race([
      this.prisma.$queryRaw`SELECT 1`.then(() => 'up'),
      this.timeout('db'),
    ]);
  }

  private async checkRedis(): Promise<string> {
    return Promise.race([
      this.redis.ping().then((pong) => (pong === 'PONG' ? 'up' : 'degraded')),
      this.timeout('redis'),
    ]);
  }

  private timeout(service: string): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${service} health check timed out`)),
        HEALTH_CHECK_TIMEOUT_MS,
      ),
    );
  }
}
