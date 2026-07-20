import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { ShortCodeGeneratorService } from './short-code-generator.service';
import { RandomBase62Generator } from './generators/random-base62.generator';
import { HashGenerator } from './generators/hash.generator';
import { HashidsGenerator } from './generators/hashids.generator';
import { SnowflakeGenerator } from './generators/snowflake.generator';
import { AutoIncrementGenerator } from './generators/auto-increment.generator';

describe('ShortCodeGeneratorService (unit)', () => {
  const randomGen = {
    generate: jest.fn().mockReturnValue('random12'),
  };
  const hashGen = {
    generate: jest.fn().mockReturnValue('hashabc'),
  };
  const hashidsGen = {
    generate: jest.fn().mockResolvedValue('hashidsxyz'),
  };
  const snowflakeGen = {
    generate: jest.fn().mockReturnValue('snowflk'),
  };
  const autoIncGen = {
    generate: jest.fn().mockResolvedValue('auto1'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createService(strategy: string) {
    return Test.createTestingModule({
      providers: [
        ShortCodeGeneratorService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) =>
              key === 'SHORT_CODE_STRATEGY' ? strategy : defaultValue,
            ),
          },
        },
        { provide: RandomBase62Generator, useValue: randomGen },
        { provide: HashGenerator, useValue: hashGen },
        { provide: HashidsGenerator, useValue: hashidsGen },
        { provide: SnowflakeGenerator, useValue: snowflakeGen },
        { provide: AutoIncrementGenerator, useValue: autoIncGen },
      ],
    }).compile();
  }

  it('uses random strategy by default', async () => {
    const module = await createService('random');
    const service = module.get(ShortCodeGeneratorService);

    expect(service.getStrategy()).toBe('random');
  });

  it('delegates generate to the correct strategy', async () => {
    const module = await createService('hash');
    const service = module.get(ShortCodeGeneratorService);
    const opts = { originalUrl: 'https://example.com' };

    const result = service.generate(opts);

    expect(result).toBe('hashabc');
    expect(hashGen.generate).toHaveBeenCalledWith(opts);
  });

  it('supports async strategies like hashids', async () => {
    const module = await createService('hashids');
    const service = module.get(ShortCodeGeneratorService);

    const result = await service.generate({
      originalUrl: 'https://example.com',
    });

    expect(result).toBe('hashidsxyz');
  });

  it('supports auto-increment strategy', async () => {
    const module = await createService('auto-increment');
    const service = module.get(ShortCodeGeneratorService);

    const result = await service.generate({
      originalUrl: 'https://example.com',
    });

    expect(result).toBe('auto1');
  });

  it('supports snowflake strategy', async () => {
    const module = await createService('snowflake');
    const service = module.get(ShortCodeGeneratorService);

    const result = service.generate({
      originalUrl: 'https://example.com',
    });

    expect(result).toBe('snowflk');
  });

  it('throws for invalid strategy', async () => {
    await expect(createService('invalid')).rejects.toThrow(
      'Invalid SHORT_CODE_STRATEGY',
    );
  });
});
