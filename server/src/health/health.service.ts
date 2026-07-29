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

  /**
   * Liveness: the process is up and the event loop is responsive. Must NOT
   * depend on external services, so a transient DB/Redis blip does not cause
   * the orchestrator to kill an otherwise-healthy container.
   */
  live() {
    return { status: 'ok' };
  }

  /**
   * Readiness: the process can serve traffic (dependencies reachable).
   */
  async ready() {
    return this.check();
  }

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
    return this.withTimeout(
      'db',
      this.prisma.$queryRaw`SELECT 1`.then(() => 'up'),
    );
  }

  private async checkRedis(): Promise<string> {
    return this.withTimeout(
      'redis',
      this.redis.ping().then((pong) => (pong === 'PONG' ? 'up' : 'degraded')),
    );
  }

  /**
   * Race a probe against a timeout, always clearing the timer afterwards so we
   * do not leak a pending 5s timeout on every health check.
   */
  private async withTimeout(
    service: string,
    probe: Promise<string>,
  ): Promise<string> {
    let timer: NodeJS.Timeout | undefined;

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${service} health check timed out`)),
        HEALTH_CHECK_TIMEOUT_MS,
      );
    });

    try {
      return await Promise.race([probe, timeout]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
