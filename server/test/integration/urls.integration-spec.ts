import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import configuration from '../../src/config/configuration';
import { MetricsModule } from '../../src/metrics/metrics.module';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RedisModule } from '../../src/redis/redis.module';
import { ShortCodeModule } from '../../src/common/short-code/short-code.module';
import { UrlsModule } from '../../src/urls/urls.module';
import { UrlsService } from '../../src/urls/service/urls.service';
import { cleanDatabase } from '../helpers/database.helper';

describe('UrlsService (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let urlsService: UrlsService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          load: [configuration],
        }),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
        LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }),
        MetricsModule,
        PrismaModule,
        RedisModule,
        ShortCodeModule,
        UrlsModule,
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    urlsService = moduleRef.get(UrlsService);

    await prisma.onModuleInit();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
    await moduleRef.close();
  });

  it('persists and reuses URLs for the same original URL', async () => {
    const dto = { originalUrl: 'https://integration.example/one' };

    const created = await urlsService.create(dto);
    const reused = await urlsService.create(dto);

    expect(created.shortCode).toBe(reused.shortCode);
    expect(await prisma.url.count()).toBe(1);
  });

  it('resolves redirects by short code and custom alias', async () => {
    const created = await urlsService.create({
      originalUrl: 'https://integration.example/two',
      customAlias: 'my-link',
    });

    await expect(urlsService.redirect(created.shortCode)).resolves.toBe(
      'https://integration.example/two',
    );
    await expect(urlsService.redirect('my-link')).resolves.toBe(
      'https://integration.example/two',
    );
  });
});
