import { Test, TestingModule } from '@nestjs/testing';

import { createPrismaMock } from '../../testing/mocks';
import { PrismaService } from '../../prisma/prisma.service';
import { ShortCodeCounterService } from './short-code-counter.service';
import { SHORT_CODE_SEQUENCE } from './short-code.constants';

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

  it('creates the sequence on module init', async () => {
    (prisma as { $executeRawUnsafe: jest.Mock }).$executeRawUnsafe =
      jest.fn().mockResolvedValue(undefined);

    await service.onModuleInit();

    expect((prisma as { $executeRawUnsafe: jest.Mock }).$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining(SHORT_CODE_SEQUENCE),
    );
  });

  it('returns the next sequence value', async () => {
    (prisma as { $queryRawUnsafe: jest.Mock }).$queryRawUnsafe = jest
      .fn()
      .mockResolvedValue([{ nextval: 42n }]);

    const result = await service.next();

    expect(result).toBe(42n);
  });
});
