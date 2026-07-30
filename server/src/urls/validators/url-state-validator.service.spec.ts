import { GoneException } from '@nestjs/common';
import { UrlStateValidatorService } from './url-state-validator.service';
import { type CachedIdentifier } from '../../cache/types';
import { type IdentifierState } from './url-state-validator.service';

describe('UrlStateValidatorService', () => {
  let service: UrlStateValidatorService;

  beforeEach(() => {
    service = new UrlStateValidatorService();
  });

  it('does not throw for an active, non-expired identifier', () => {
    const identifier: CachedIdentifier = {
      id: '1',
      urlId: 'url-1',
      originalUrl: 'https://example.com',
      code: 'abc',
      kind: 'GENERATED',
      ownerId: null,
      strategy: 'RANDOM',
      disabled: false,
      expiresAt: null,
      deletedAt: null,
    };
    expect(() => service.validate(identifier)).not.toThrow();
  });

  it('throws GoneException when identifier is disabled', () => {
    const identifier: IdentifierState = {
      disabled: true,
      expiresAt: null,
      deletedAt: null,
    };
    expect(() => service.validate(identifier)).toThrow(GoneException);
  });

  it('throws GoneException when identifier is expired', () => {
    const identifier: IdentifierState = {
      disabled: false,
      expiresAt: new Date('2020-01-01'),
      deletedAt: null,
    };
    expect(() => service.validate(identifier)).toThrow(GoneException);
  });

  it('does not throw when expiresAt is in the future', () => {
    const futureDate = new Date(Date.now() + 86400000);
    const identifier: IdentifierState = {
      disabled: false,
      expiresAt: futureDate,
      deletedAt: null,
    };
    expect(() => service.validate(identifier)).not.toThrow();
  });

  it('throws GoneException when identifier is deleted', () => {
    const identifier: IdentifierState = {
      disabled: false,
      expiresAt: null,
      deletedAt: new Date('2020-01-01'),
    };
    expect(() => service.validate(identifier)).toThrow(GoneException);
  });

  it('handles expiresAt as ISO string (CachedIdentifier)', () => {
    const identifier: CachedIdentifier = {
      id: '1',
      urlId: 'url-1',
      originalUrl: 'https://example.com',
      code: 'abc',
      kind: 'GENERATED',
      ownerId: null,
      strategy: 'RANDOM',
      disabled: false,
      expiresAt: '2020-01-01T00:00:00.000Z',
      deletedAt: null,
    };
    expect(() => service.validate(identifier)).toThrow(GoneException);
  });
});
