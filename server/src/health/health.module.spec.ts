import { Test, TestingModule } from '@nestjs/testing';

import { HealthModule } from './health.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';

const prismaMock = {
  $queryRaw: jest.fn(),
};

const redisMock = {
  ping: jest.fn().mockResolvedValue('PONG'),
};

describe('HealthModule (unit)', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [HealthModule, PrismaModule, RedisModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
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
