import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UrlMapper } from './urls.mapper';
import { createConfigMock } from '../../testing/mocks';
import { type Identifier, type Url } from '@prisma/client';

describe('UrlMapper', () => {
  let mapper: UrlMapper;
  const config = createConfigMock({ BASE_URL: 'http://localhost:3000/' });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UrlMapper, { provide: ConfigService, useValue: config }],
    }).compile();

    mapper = module.get(UrlMapper);
  });

  describe('toResponse', () => {
    it('maps Url + Identifier to CreateUrlResponseDto', () => {
      const url: Url = {
        id: '1',
        originalUrl: 'https://example.com',
        normalizedUrl: 'https://example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const identifier: Identifier = {
        id: 'i1',
        code: 'abc123',
        kind: 'GENERATED',
        strategy: 'RANDOM',
        urlId: '1',
        ownerId: null,
        expiresAt: null,
        disabled: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = mapper.toResponse(url, identifier);

      expect(result).toEqual({
        id: 'i1',
        originalUrl: 'https://example.com',
        shortCode: 'abc123',
        shortUrl: 'http://localhost:3000/abc123',
      });
    });
  });

  describe('toCached', () => {
    it('maps Url + Identifier to CachedIdentifier with expiresAt as ISO string', () => {
      const expiresAt = new Date('2025-12-31T23:59:59.000Z');
      const url: Url = {
        id: '2',
        originalUrl: 'https://example.com',
        normalizedUrl: 'https://example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const identifier: Identifier = {
        id: 'i2',
        code: 'xyz789',
        kind: 'CUSTOM_ALIAS',
        strategy: 'MANUAL',
        urlId: '2',
        ownerId: null,
        expiresAt,
        disabled: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = mapper.toCached(url, identifier);

      expect(result.id).toBe('i2');
      expect(result.urlId).toBe('2');
      expect(result.originalUrl).toBe('https://example.com');
      expect(result.code).toBe('xyz789');
      expect(result.kind).toBe('CUSTOM_ALIAS');
      expect(result.disabled).toBe(false);
      expect(result.expiresAt).toBe(expiresAt.toISOString());
    });

    it('maps null expiresAt to null', () => {
      const url: Url = {
        id: '3',
        originalUrl: 'https://example.com',
        normalizedUrl: 'https://example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const identifier: Identifier = {
        id: 'i3',
        code: 'noexp',
        kind: 'GENERATED',
        strategy: 'RANDOM',
        urlId: '3',
        ownerId: null,
        expiresAt: null,
        disabled: true,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = mapper.toCached(url, identifier);

      expect(result.expiresAt).toBeNull();
      expect(result.disabled).toBe(true);
    });
  });
});
