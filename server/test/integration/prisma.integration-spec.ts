import { Test, TestingModule } from '@nestjs/testing';

import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { cleanDatabase } from '../helpers/database.helper';

describe('PrismaService (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
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
        shortCode: 'prisma01',
        strategy: 'random',
      },
    });

    const found = await prisma.url.findFirst({
      where: { shortCode: 'prisma01' },
    });

    expect(found?.id).toBe(created.id);
  });
});
