import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UrlMapper } from './urls.mapper';
import { createConfigMock } from '../../testing/mocks';
import { type Url } from '../types';

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
    it('maps a Url entity to CreateUrlResponseDto', () => {
      const url: Url = {
        id: '1',
        originalUrl: 'https://example.com',
        shortCode: 'abc123',
        customAlias: null,
        disabled: false,
        expiresAt: null,
      };

      const result = mapper.toResponse(url);

      expect(result).toEqual({
        id: '1',
        originalUrl: 'https://example.com',
        shortCode: 'abc123',
        shortUrl: 'http://localhost:3000/abc123',
      });
    });
  });

  describe('toCached', () => {
    it('maps a Url entity to CachedUrl with expiresAt as ISO string', () => {
      const expiresAt = new Date('2025-12-31T23:59:59.000Z');
      const url: Url = {
        id: '2',
        originalUrl: 'https://example.com',
        shortCode: 'xyz789',
        customAlias: 'my-alias',
        disabled: false,
        expiresAt,
      };

      const result = mapper.toCached(url);

      expect(result.id).toBe('2');
      expect(result.originalUrl).toBe('https://example.com');
      expect(result.shortCode).toBe('xyz789');
      expect(result.customAlias).toBe('my-alias');
      expect(result.disabled).toBe(false);
      expect(result.expiresAt).toBe(expiresAt.toISOString());
      expect(result.lastAccessedAt).toBeDefined();
    });

    it('maps null expiresAt to null string', () => {
      const url: Url = {
        id: '3',
        originalUrl: 'https://example.com',
        shortCode: 'noexp',
        customAlias: null,
        disabled: true,
        expiresAt: null,
      };

      const result = mapper.toCached(url);

      expect(result.expiresAt).toBeNull();
      expect(result.disabled).toBe(true);
    });
  });
});
