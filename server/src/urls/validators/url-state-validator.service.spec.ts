import { GoneException } from '@nestjs/common';
import { UrlStateValidatorService } from './url-state-validator.service';
import { CachedUrl } from '../../redis/redis.interface';
import { Url } from '../urls.interface';

describe('UrlStateValidatorService', () => {
  let service: UrlStateValidatorService;

  beforeEach(() => {
    service = new UrlStateValidatorService();
  });

  it('does not throw for an active, non-expired URL', () => {
    const url: CachedUrl = {
      id: '1',
      originalUrl: 'https://example.com',
      shortCode: 'abc',
      customAlias: null,
      disabled: false,
      expiresAt: null,
      lastAccessedAt: null,
    };
    expect(() => service.validate(url)).not.toThrow();
  });

  it('throws GoneException when URL is disabled', () => {
    const url: Url = {
      id: '1',
      originalUrl: 'https://example.com',
      shortCode: 'abc',
      customAlias: null,
      disabled: true,
      expiresAt: null,
    };
    expect(() => service.validate(url)).toThrow(GoneException);
  });

  it('throws GoneException when URL is expired', () => {
    const url: Url = {
      id: '1',
      originalUrl: 'https://example.com',
      shortCode: 'abc',
      customAlias: null,
      disabled: false,
      expiresAt: new Date('2020-01-01'),
    };
    expect(() => service.validate(url)).toThrow(GoneException);
  });

  it('does not throw when expiresAt is in the future', () => {
    const futureDate = new Date(Date.now() + 86400000);
    const url: Url = {
      id: '1',
      originalUrl: 'https://example.com',
      shortCode: 'abc',
      customAlias: null,
      disabled: false,
      expiresAt: futureDate,
    };
    expect(() => service.validate(url)).not.toThrow();
  });

  it('handles expiresAt as ISO string (CachedUrl)', () => {
    const url: CachedUrl = {
      id: '1',
      originalUrl: 'https://example.com',
      shortCode: 'abc',
      customAlias: null,
      disabled: false,
      expiresAt: '2020-01-01T00:00:00.000Z',
      lastAccessedAt: null,
    };
    expect(() => service.validate(url)).toThrow(GoneException);
  });
});
