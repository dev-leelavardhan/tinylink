import { BadRequestException } from '@nestjs/common';

import { ZodValidationPipe } from './common.validation';
import { CreateUrlDto, createUrlSchema } from '../../urls/dto/create-url.dto';

describe('ZodValidationPipe (unit)', () => {
  const pipe = new ZodValidationPipe(createUrlSchema);

  it('returns parsed data for valid input', () => {
    const result = pipe.transform({
      originalUrl: 'https://example.com',
    }) as CreateUrlDto;
    expect(result.originalUrl).toBe('https://example.com');
  });

  it('throws BadRequestException for invalid input', () => {
    expect(() => pipe.transform({ originalUrl: 'not-a-url' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects URLs that do not use HTTP or HTTPS', () => {
    expect(() =>
      pipe.transform({ originalUrl: 'ftp://example.com/file' }),
    ).toThrow(BadRequestException);
  });

  it('accepts a valid expiresAt date in the future', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const result = pipe.transform({
      originalUrl: 'https://example.com',
      expiresAt: futureDate,
    }) as CreateUrlDto;
    expect(result.expiresAt).toBeDefined();
  });

  it('rejects an expiresAt date in the past', () => {
    expect(() =>
      pipe.transform({
        originalUrl: 'https://example.com',
        expiresAt: '2020-01-01T00:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
  });

  it('accepts a valid custom alias', () => {
    const result = pipe.transform({
      originalUrl: 'https://example.com',
      customAlias: 'my-link',
    }) as CreateUrlDto;
    expect(result.customAlias).toBe('my-link');
  });
});
