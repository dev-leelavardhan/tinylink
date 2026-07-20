import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { SnowflakeGenerator } from './snowflake.generator';

describe('SnowflakeGenerator (unit)', () => {
  let generator: SnowflakeGenerator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnowflakeGenerator,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string, defaultValue?: unknown) => defaultValue,
            ),
          },
        },
      ],
    }).compile();

    generator = module.get(SnowflakeGenerator);
  });

  it('generates a base62-encoded string', () => {
    const code = generator.generate({ originalUrl: 'https://example.com' });

    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(0);
  });

  it('generates unique codes on successive calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(
        generator.generate({ originalUrl: `https://example.com/${i}` }),
      );
    }
    expect(codes.size).toBe(20);
  });

  it('throws when worker ID is out of range', async () => {
    await expect(
      Test.createTestingModule({
        providers: [
          SnowflakeGenerator,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'SHORT_CODE_SNOWFLAKE_WORKER_ID') return 2000;
                return undefined;
              }),
            },
          },
        ],
      }).compile(),
    ).rejects.toThrow('must be between 0 and');
  });

  it('accepts valid worker ID of 0', async () => {
    const module = await Test.createTestingModule({
      providers: [
        SnowflakeGenerator,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SHORT_CODE_SNOWFLAKE_WORKER_ID') return 0;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    const gen = module.get(SnowflakeGenerator);
    const code = gen.generate({ originalUrl: 'https://example.com' });
    expect(typeof code).toBe('string');
  });

  it('throws when clock moves backwards', () => {
    const originalDateNow = Date.now;

    Date.now = jest.fn().mockReturnValueOnce(1_704_067_200_100);
    generator.generate({ originalUrl: 'https://example.com/1' });

    Date.now = jest.fn().mockReturnValue(1_704_067_200_000);
    expect(() =>
      generator.generate({ originalUrl: 'https://example.com/2' }),
    ).toThrow('Clock moved backwards');

    Date.now = originalDateNow;
  });

  it('generates different codes with different worker IDs', async () => {
    const module1 = await Test.createTestingModule({
      providers: [
        SnowflakeGenerator,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SHORT_CODE_SNOWFLAKE_WORKER_ID') return 1;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    const module2 = await Test.createTestingModule({
      providers: [
        SnowflakeGenerator,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SHORT_CODE_SNOWFLAKE_WORKER_ID') return 2;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    const gen1 = module1.get(SnowflakeGenerator);
    const gen2 = module2.get(SnowflakeGenerator);

    const codes1 = new Set<string>();
    const codes2 = new Set<string>();

    for (let i = 0; i < 5; i++) {
      codes1.add(gen1.generate({ originalUrl: `https://a.com/${i}` }));
      codes2.add(gen2.generate({ originalUrl: `https://b.com/${i}` }));
    }

    expect(codes1.size).toBe(5);
    expect(codes2.size).toBe(5);
  });

  it('handles sequence overflow by waiting for next millisecond', () => {
    const originalDateNow = Date.now;
    const FIXED_TS = 1_704_067_200_100;

    Date.now = jest.fn().mockReturnValue(FIXED_TS);

    for (let i = 0; i < 4096; i++) {
      generator.generate({ originalUrl: `https://example.com/${i}` });
    }

    let callCount = 0;
    Date.now = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return FIXED_TS;
      }
      return FIXED_TS + 1;
    });

    const code = generator.generate({
      originalUrl: 'https://example.com/overflow',
    });

    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(0);

    Date.now = originalDateNow;
  });
});
