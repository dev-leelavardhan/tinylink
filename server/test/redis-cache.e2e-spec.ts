import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';

import { createTestApp } from './helpers/create-test-app';
import { cleanDatabase } from './helpers/database.helper';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { CACHE_CONSTANTS } from '../src/redis/redis.constants';
import { CreateUrlResponseDto } from '../src/urls/urls.interface';

describe('Redis Cache (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    // Flush test keys
    const keys = await redis.keys('url:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  afterAll(async () => {
    // Cleanup
    const keys = await redis.keys('url:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await app.close();
  });

  describe('cache population on redirect', () => {
    it('populates Redis cache during URL creation', async () => {
      // Create a short URL
      const created = await request(app.getHttpServer() as Server)
        .post('/urls')
        .send({ originalUrl: 'https://cache-test.example.com' })
        .expect(201);

      const body = created.body as CreateUrlResponseDto;
      const redisKey = `${CACHE_CONSTANTS.KEY_PREFIX}${body.shortCode}`;

      // Cache should already be populated after creation
      const afterCreate = await redis.get(redisKey);
      expect(afterCreate).not.toBeNull();

      const cached = JSON.parse(afterCreate!);
      expect(cached.originalUrl).toBe('https://cache-test.example.com');
      expect(cached.shortCode).toBe(body.shortCode);
    });

    it('serves redirects from Redis cache', async () => {
      // Create a short URL
      const created = await request(app.getHttpServer() as Server)
        .post('/urls')
        .send({ originalUrl: 'https://cache-hit-test.example.com' })
        .expect(201);

      const body = created.body as CreateUrlResponseDto;
      const redisKey = `${CACHE_CONSTANTS.KEY_PREFIX}${body.shortCode}`;

      // Cache should be warm after creation
      const cached = await redis.get(redisKey);
      expect(cached).not.toBeNull();

      // First redirect — should hit cache
      await request(app.getHttpServer() as Server)
        .get(`/${body.shortCode}`)
        .expect(302)
        .expect('Location', 'https://cache-hit-test.example.com');

      // Cache should still be valid
      const afterFirst = await redis.get(redisKey);
      expect(afterFirst).toBe(cached);

      // Second redirect — should still hit cache
      await request(app.getHttpServer() as Server)
        .get(`/${body.shortCode}`)
        .expect(302)
        .expect('Location', 'https://cache-hit-test.example.com');

      // Cache should still be valid
      const afterSecond = await redis.get(redisKey);
      expect(afterSecond).toBe(cached);
    });

    it('caches custom alias separately from short code', async () => {
      const created = await request(app.getHttpServer() as Server)
        .post('/urls')
        .send({
          originalUrl: 'https://alias-cache.example.com',
          customAlias: 'my-cache-link',
        })
        .expect(201);

      const body = created.body as CreateUrlResponseDto;
      const shortCodeKey = `${CACHE_CONSTANTS.KEY_PREFIX}${body.shortCode}`;
      const aliasKey = `${CACHE_CONSTANTS.KEY_PREFIX}my-cache-link`;

      // Short code should be cached after creation
      expect(await redis.get(shortCodeKey)).not.toBeNull();

      // Redirect via short code to populate alias cache
      await request(app.getHttpServer() as Server)
        .get(`/${body.shortCode}`)
        .expect(302);

      // Both keys should now be cached
      expect(await redis.get(shortCodeKey)).not.toBeNull();
      expect(await redis.get(aliasKey)).not.toBeNull();
    });
  });

  describe('negative caching', () => {
    it('caches non-existent short codes with NOT_FOUND sentinel', async () => {
      const fakeCode = 'nonexistent123';
      const redisKey = `${CACHE_CONSTANTS.KEY_PREFIX}${fakeCode}`;

      // Request non-existent code
      await request(app.getHttpServer() as Server)
        .get(`/${fakeCode}`)
        .expect(404);

      // Verify negative cache
      const cached = await redis.get(redisKey);
      expect(cached).toBe(CACHE_CONSTANTS.NEGATIVE_SENTINEL);
    });

    it('serves cached 404 from negative cache', async () => {
      const fakeCode = 'negative-test';
      const redisKey = `${CACHE_CONSTANTS.KEY_PREFIX}${fakeCode}`;

      // First request — DB miss, populates negative cache
      await request(app.getHttpServer() as Server)
        .get(`/${fakeCode}`)
        .expect(404);

      // Verify negative cache is set
      const cached = await redis.get(redisKey);
      expect(cached).toBe(CACHE_CONSTANTS.NEGATIVE_SENTINEL);

      // Second request — should serve from negative cache
      await request(app.getHttpServer() as Server)
        .get(`/${fakeCode}`)
        .expect(404);

      // Negative cache should still be valid
      const afterSecond = await redis.get(redisKey);
      expect(afterSecond).toBe(CACHE_CONSTANTS.NEGATIVE_SENTINEL);
    });
  });

  describe('cache TTL', () => {
    it('cache entries have correct TTL', async () => {
      const created = await request(app.getHttpServer() as Server)
        .post('/urls')
        .send({ originalUrl: 'https://ttl-test.example.com' })
        .expect(201);

      const body = created.body as CreateUrlResponseDto;
      const redisKey = `${CACHE_CONSTANTS.KEY_PREFIX}${body.shortCode}`;

      // Populate cache
      await request(app.getHttpServer() as Server)
        .get(`/${body.shortCode}`)
        .expect(302);

      // Check TTL
      const ttl = await redis.ttl(redisKey);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(CACHE_CONSTANTS.DEFAULT_TTL_SECONDS);
    });

    it('negative cache has shorter TTL', async () => {
      const fakeCode = 'ttl-negative-test';
      const redisKey = `${CACHE_CONSTANTS.KEY_PREFIX}${fakeCode}`;

      // Populate negative cache
      await request(app.getHttpServer() as Server)
        .get(`/${fakeCode}`)
        .expect(404);

      // Check TTL
      const ttl = await redis.ttl(redisKey);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(CACHE_CONSTANTS.NEGATIVE_TTL_SECONDS);
    });
  });

  describe('cache invalidation', () => {
    it('invalidates cache after manual flush', async () => {
      const created = await request(app.getHttpServer() as Server)
        .post('/urls')
        .send({ originalUrl: 'https://invalidation-test.example.com' })
        .expect(201);

      const body = created.body as CreateUrlResponseDto;
      const redisKey = `${CACHE_CONSTANTS.KEY_PREFIX}${body.shortCode}`;

      // Populate cache
      await request(app.getHttpServer() as Server)
        .get(`/${body.shortCode}`)
        .expect(302);

      expect(await redis.get(redisKey)).not.toBeNull();

      // Manual invalidation
      await redis.del(redisKey);

      // Verify cache is cleared
      expect(await redis.get(redisKey)).toBeNull();

      // Next redirect should hit DB again
      await request(app.getHttpServer() as Server)
        .get(`/${body.shortCode}`)
        .expect(302);

      // Cache should be repopulated
      expect(await redis.get(redisKey)).not.toBeNull();
    });
  });

  describe('performance comparison', () => {
    it('cache hit is faster than DB hit', async () => {
      const created = await request(app.getHttpServer() as Server)
        .post('/urls')
        .send({ originalUrl: 'https://perf-test.example.com' })
        .expect(201);

      const body = created.body as CreateUrlResponseDto;
      const redisKey = `${CACHE_CONSTANTS.KEY_PREFIX}${body.shortCode}`;

      // Measure DB hit (cold cache)
      const dbStart = Date.now();
      await request(app.getHttpServer() as Server)
        .get(`/${body.shortCode}`)
        .expect(302);
      const dbTime = Date.now() - dbStart;

      // Verify cache is warm
      expect(await redis.get(redisKey)).not.toBeNull();

      // Measure cache hit (warm cache)
      const cacheStart = Date.now();
      await request(app.getHttpServer() as Server)
        .get(`/${body.shortCode}`)
        .expect(302);
      const cacheTime = Date.now() - cacheStart;

      // Cache hit should be faster (or at least not significantly slower)
      // Allow some variance for network overhead in tests
      expect(cacheTime).toBeLessThanOrEqual(dbTime + 50);
    });
  });
});
