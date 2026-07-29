import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { cleanDatabase } from '../helpers/database.helper';

describe('PrismaService (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, cache: true }),
        PrismaModule,
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
    await moduleRef.close();
  });

  it('connects to the test database', async () => {
    await expect(prisma.$queryRaw`SELECT 1`).resolves.toEqual([
      { '?column?': 1 },
    ]);
  });

  it('supports Url model CRUD operations', async () => {
    const created = await prisma.url.create({
      data: {
        originalUrl: 'https://prisma.integration.example',
        normalizedUrl: 'https://prisma.integration.example',
      },
    });

    const found = await prisma.url.findUnique({
      where: { normalizedUrl: 'https://prisma.integration.example' },
    });

    expect(found?.id).toBe(created.id);
    expect(found?.originalUrl).toBe('https://prisma.integration.example');
  });

  it('supports Identifier model CRUD operations', async () => {
    const url = await prisma.url.create({
      data: {
        originalUrl: 'https://prisma.identifier.example',
        normalizedUrl: 'https://prisma.identifier.example',
      },
    });

    const identifier = await prisma.identifier.create({
      data: {
        code: 'prisma01',
        kind: 'GENERATED',
        strategy: 'RANDOM',
        url: { connect: { id: url.id } },
      },
    });

    const found = await prisma.identifier.findUnique({
      where: { code: 'prisma01' },
    });

    expect(found?.id).toBe(identifier.id);
    expect(found?.urlId).toBe(url.id);
  });
});
