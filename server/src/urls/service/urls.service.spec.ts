import { Test, TestingModule } from '@nestjs/testing';
import { UrlsService } from './urls.service';
import { UrlCreateService } from '../use-cases/url-create.service';
import { UrlRedirectService } from '../use-cases/url-redirect.service';
import { CreateUrlDto } from '../dto/create-url.dto';

describe('UrlsService (unit)', () => {
  let service: UrlsService;

  const mockCreator = {
    create: jest.fn(),
  };

  const mockRedirector = {
    redirect: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlsService,
        { provide: UrlCreateService, useValue: mockCreator },
        { provide: UrlRedirectService, useValue: mockRedirector },
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

      const result = await service.create(dto);

      expect(result).toEqual(expectedResult);
      expect(mockCreator.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('redirect', () => {
    it('delegates to UrlRedirectService', async () => {
      const shortCode = 'abc1234';
      const expectedUrl = 'https://example.com';

      mockRedirector.redirect.mockResolvedValue(expectedUrl);

      const result = await service.redirect(shortCode);

      expect(result).toBe(expectedUrl);
      expect(mockRedirector.redirect).toHaveBeenCalledWith(shortCode);
    });
  });
});
