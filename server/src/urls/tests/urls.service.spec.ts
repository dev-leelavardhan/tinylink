import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { UrlsService } from '../service/urls.service';

describe('UrlsService', () => {
  let service: UrlsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UrlsService],
    }).compile();

    service = module.get<UrlsService>(UrlsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should allow querying Url records without schema mismatch errors', async () => {
    const prisma = new PrismaService();

    await prisma.onModuleInit();

    try {
      const result = await prisma.url.findFirst({
        where: { shortCode: 'does-not-exist' },
      });

      expect(result).toBeNull();
    } finally {
      await prisma.onModuleDestroy();
    }
  });
});
