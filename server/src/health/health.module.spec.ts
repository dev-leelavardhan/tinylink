import { Test, TestingModule } from '@nestjs/testing';

import { HealthModule } from './health.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  $queryRaw: jest.fn(),
};

describe('HealthModule (unit)', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [HealthModule, PrismaModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('provides HealthController', () => {
    expect(module.get(HealthController)).toBeDefined();
  });

  it('provides HealthService', () => {
    expect(module.get(HealthService)).toBeDefined();
  });
});
