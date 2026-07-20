import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { HashGenerator } from './hash.generator';
import {
  RANDOM_BASE_CONSTANTS,
  SHORT_CODE_CONFIG_KEYS,
} from '../short-code.constants';

describe('HashGenerator (unit)', () => {
  let generator: HashGenerator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HashGenerator,
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

    generator = module.get(HashGenerator);
  });

  it('generates a deterministic code for the same URL', () => {
    const url = 'https://example.com';
    const first = generator.generate({ originalUrl: url });
    const second = generator.generate({ originalUrl: url });

    expect(first).toBe(second);
  });

  it('generates different codes for different URLs', () => {
    const first = generator.generate({ originalUrl: 'https://a.com' });
    const second = generator.generate({ originalUrl: 'https://b.com' });

    expect(first).not.toBe(second);
  });

  it('generates codes using only valid base62 characters', () => {
    const validChars = new Set(RANDOM_BASE_CONSTANTS.RANDOM_BASE.split(''));
    const code = generator.generate({ originalUrl: 'https://example.com' });

    for (const char of code) {
      expect(validChars.has(char)).toBe(true);
    }
  });

  it('generates a code of the default length', () => {
    const code = generator.generate({ originalUrl: 'https://example.com' });
    expect(code).toHaveLength(RANDOM_BASE_CONSTANTS.SHORT_CODE_LENGTH);
  });

  it('changes output with different attempt values', () => {
    const first = generator.generate({ originalUrl: 'https://example.com', attempt: 1 });
    const second = generator.generate({ originalUrl: 'https://example.com', attempt: 2 });

    expect(first).not.toBe(second);
  });
});
