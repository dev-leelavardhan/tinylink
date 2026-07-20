import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { HashidsGenerator } from './hashids.generator';
import { ShortCodeCounterService } from '../short-code-counter.service';

describe('HashidsGenerator (unit)', () => {
  let generator: HashidsGenerator;
  const counter = { next: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    counter.next.mockResolvedValue(1n);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HashidsGenerator,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'SHORT_CODE_HASHIDS_SALT') return 'test-salt-value-1234';
              return undefined;
            }),
            get: jest.fn(
              (key: string, defaultValue?: unknown) => defaultValue,
            ),
          },
        },
        { provide: ShortCodeCounterService, useValue: counter },
      ],
    }).compile();

    generator = module.get(HashidsGenerator);
  });

  it('generates a code from a counter value', async () => {
    const code = await generator.generate({ originalUrl: 'https://example.com' });

    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(0);
    expect(counter.next).toHaveBeenCalledTimes(1);
  });

  it('generates different codes for different counter values', async () => {
    counter.next.mockResolvedValueOnce(1n).mockResolvedValueOnce(2n);

    const first = await generator.generate({ originalUrl: 'https://a.com' });
    const second = await generator.generate({ originalUrl: 'https://b.com' });

    expect(first).not.toBe(second);
  });

  it('caches the Hashids instance', async () => {
    await generator.generate({ originalUrl: 'https://example.com' });
    await generator.generate({ originalUrl: 'https://example.com' });

    expect(counter.next).toHaveBeenCalledTimes(2);
  });
});
