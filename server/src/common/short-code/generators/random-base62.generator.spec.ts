import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { RandomBase62Generator } from './random-base62.generator';
import { RANDOM_BASE_CONSTANTS } from '../short-code.constants';

describe('RandomBase62Generator (unit)', () => {
  let generator: RandomBase62Generator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RandomBase62Generator,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
          },
        },
      ],
    }).compile();

    generator = module.get(RandomBase62Generator);
  });

  it('generates a code of the default length', () => {
    const code = generator.generate({ originalUrl: 'https://example.com' });

    expect(code).toHaveLength(RANDOM_BASE_CONSTANTS.SHORT_CODE_LENGTH);
  });

  it('generates codes using only valid base62 characters', () => {
    const validChars = new Set(RANDOM_BASE_CONSTANTS.RANDOM_BASE.split(''));

    for (let i = 0; i < 50; i++) {
      const code = generator.generate({
        originalUrl: `https://example.com/${i}`,
      });
      for (const char of code) {
        expect(validChars.has(char)).toBe(true);
      }
    }
  });

  it('generates different codes on successive calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(
        generator.generate({ originalUrl: `https://example.com/${i}` }),
      );
    }
    expect(codes.size).toBeGreaterThan(1);
  });
});
