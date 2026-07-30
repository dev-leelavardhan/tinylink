import { Test, TestingModule } from '@nestjs/testing';
import { UrlsService } from './urls.service';
import { UrlCreateService } from '../use-cases/url-create.service';
import { UrlRedirectService } from '../use-cases/url-redirect.service';
import { UrlQrService } from '../use-cases/url-qr.service';
import { CreateUrlDto } from '../dto/create-url.dto';

describe('UrlsService (unit)', () => {
  let service: UrlsService;

  const mockCreator = {
    create: jest.fn(),
  };

  const mockRedirector = {
    redirect: jest.fn(),
  };

  const mockQrService = {
    generate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlsService,
        { provide: UrlCreateService, useValue: mockCreator },
        { provide: UrlRedirectService, useValue: mockRedirector },
        { provide: UrlQrService, useValue: mockQrService },
      ],
    }).compile();

    service = module.get(UrlsService);
  });

  describe('create', () => {
    it('delegates to UrlCreateService', async () => {
      const dto: CreateUrlDto = { originalUrl: 'https://example.com' };
      const expectedResult = {
        shortCode: 'abc1234',
        originalUrl: 'https://example.com',
        shortUrl: 'http://localhost:3000/abc1234',
      };

      mockCreator.create.mockResolvedValue(expectedResult);

      const result = await service.create(dto, 'user-1', '127.0.0.1');

      expect(result).toEqual(expectedResult);
      expect(mockCreator.create).toHaveBeenCalledWith(
        dto,
        'user-1',
        '127.0.0.1',
      );
    });
  });

  describe('redirect', () => {
    it('delegates to UrlRedirectService', async () => {
      const shortCode = 'abc1234';
      const expectedUrl = 'https://example.com';
      const requestMeta = {
        userAgent: 'test-agent',
        referrer: 'https://example.com',
        ip: '127.0.0.1',
      };

      mockRedirector.redirect.mockResolvedValue(expectedUrl);

      const result = await service.redirect(shortCode, requestMeta);

      expect(result).toBe(expectedUrl);
      expect(mockRedirector.redirect).toHaveBeenCalledWith(
        shortCode,
        requestMeta,
      );
    });
  });

  describe('getQrCode', () => {
    it('delegates to UrlQrService', async () => {
      const shortCode = 'abc1234';
      const format = 'png';
      const size = 300;
      const expectedResult = {
        buffer: Buffer.from('fake-png'),
        contentType: 'image/png',
      };

      mockQrService.generate.mockResolvedValue(expectedResult);

      const result = await service.getQrCode(shortCode, format, size);

      expect(result).toEqual(expectedResult);
      expect(mockQrService.generate).toHaveBeenCalledWith(
        shortCode,
        format,
        size,
      );
    });
  });
});
