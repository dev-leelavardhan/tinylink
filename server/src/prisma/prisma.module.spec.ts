import { Test, TestingModule } from '@nestjs/testing';

import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';

describe('PrismaModule (unit)', () => {
  let module: TestingModule;

  beforeEach(async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

    module = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('provides PrismaService', () => {
    expect(module.get(PrismaService)).toBeDefined();
  });

  it('exports PrismaService', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const exports: unknown[] =
      Reflect.getMetadata('exports', PrismaModule) || [];
    expect(exports).toContain(PrismaService);
  });
});
