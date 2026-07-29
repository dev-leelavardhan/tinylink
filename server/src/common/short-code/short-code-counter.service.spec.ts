import { Test, TestingModule } from '@nestjs/testing';

import { createPrismaMock } from '../../testing/mocks';
import { PrismaService } from '../../prisma/prisma.service';
import { ShortCodeCounterService } from './short-code-counter.service';

describe('ShortCodeCounterService (unit)', () => {
  let service: ShortCodeCounterService;
  const prisma = createPrismaMock();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShortCodeCounterService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ShortCodeCounterService);
  });

  it('returns the next sequence value', async () => {
    (prisma as { $queryRawUnsafe: jest.Mock }).$queryRawUnsafe = jest
      .fn()
      .mockResolvedValue([{ nextval: 42n }]);

    const result = await service.next();

    expect(result).toBe(42n);
  });
});
