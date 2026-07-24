import { Test, TestingModule } from '@nestjs/testing';

import { RedisModule } from './redis.module';
import { RedisService } from './service/redis.service';

const redisMock = {
  ping: jest.fn().mockResolvedValue('PONG'),
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue('OK'),
};

describe('RedisModule (unit)', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [RedisModule],
    })
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('provides RedisService', () => {
    expect(module.get(RedisService)).toBeDefined();
  });

  it('exports RedisService', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const exports: unknown[] =
      Reflect.getMetadata('exports', RedisModule) || [];
    expect(exports).toContain(RedisService);
  });
});
