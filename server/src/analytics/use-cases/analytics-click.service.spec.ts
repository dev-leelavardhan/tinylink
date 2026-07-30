import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { AnalyticsClickService } from './analytics-click.service';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { ClickJobData } from '../types';

jest.mock('node:fs/promises', () => ({
  access: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('maxmind', () => ({
  open: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue({
      country: { iso_code: 'US' },
    }),
  }),
}));

describe('AnalyticsClickService', () => {
  let service: AnalyticsClickService;
  let repository: {
    create: jest.Mock;
  };
  let config: {
    getOrThrow: jest.Mock;
    get: jest.Mock;
  };
  let logger: {
    setContext: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    repository = {
      create: jest.fn().mockResolvedValue({}),
    };

    config = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key === 'IP_HASH_SALT') return 'test-salt';
        return null;
      }),
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue: unknown) => {
          if (key === 'GEOLITE2_DB_PATH') return './test.mmdb';
          return defaultValue;
        }),
    };

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsClickService,
        { provide: AnalyticsRepository, useValue: repository },
        { provide: ConfigService, useValue: config },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get<AnalyticsClickService>(AnalyticsClickService);
  });

  describe('onModuleInit', () => {
    it('loads GeoLite2 database', async () => {
      await service.onModuleInit();

      expect(logger.info).toHaveBeenCalledWith(
        { database: './test.mmdb' },
        'GeoLite2 database loaded',
      );
    });

    it('handles missing GeoLite2 database', async () => {
      const fs: { access: jest.Mock } = jest.requireMock('node:fs/promises');
      fs.access.mockRejectedValueOnce(new Error('ENOENT'));

      await service.onModuleInit();

      expect(logger.warn).toHaveBeenCalledWith(
        { database: './test.mmdb' },
        'GeoLite2 database not found, country resolution disabled',
      );
    });
  });

  describe('processClick', () => {
    it('creates analytics record with correct data', async () => {
      await service.onModuleInit();

      const data: ClickJobData = {
        urlId: 'url-id',
        identifierId: 'identifier-1',
        shortCode: 'abc123',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        referrer: 'https://example.com/page',
        ip: '192.168.1.1',
      };

      await service.processClick(data);

      expect(repository.create).toHaveBeenCalledWith({
        url: { connect: { id: 'url-id' } },
        identifier: { connect: { id: 'identifier-1' } },
        browser: 'Chrome',
        os: 'Windows',
        device: 'Desktop',
        country: 'US',
        ipHash: expect.any(String) as string,
        referrer: 'example.com',
      });
    });

    it('handles missing IP', async () => {
      await service.onModuleInit();

      const data: ClickJobData = {
        urlId: 'url-id',
        identifierId: 'identifier-1',
        shortCode: 'abc123',
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
      };

      await service.processClick(data);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          country: null,
          ipHash: expect.any(String) as string,
        }),
      );
    });

    it('handles missing referrer', async () => {
      await service.onModuleInit();

      const data: ClickJobData = {
        urlId: 'url-id',
        identifierId: 'identifier-1',
        shortCode: 'abc123',
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
        ip: '192.168.1.1',
      };

      await service.processClick(data);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          referrer: null,
        }),
      );
    });

    it('handles P2025 error gracefully', async () => {
      await service.onModuleInit();

      const prismaError = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });
      repository.create.mockRejectedValueOnce(prismaError);

      const data: ClickJobData = {
        urlId: 'url-id',
        identifierId: 'identifier-1',
        shortCode: 'abc123',
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
        ip: '192.168.1.1',
      };

      await service.processClick(data);

      expect(logger.warn).toHaveBeenCalledWith(
        { urlId: 'url-id', identifierId: 'identifier-1' },
        'URL or Identifier not found, skipping analytics recording',
      );
    });

    it('re-throws non-P2025 errors', async () => {
      await service.onModuleInit();

      const error = new Error('Database connection failed');
      repository.create.mockRejectedValueOnce(error);

      const data: ClickJobData = {
        urlId: 'url-id',
        identifierId: 'identifier-1',
        shortCode: 'abc123',
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
        ip: '192.168.1.1',
      };

      await expect(service.processClick(data)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('resolveCountry', () => {
    it('returns null when geoIpReader throws', async () => {
      const maxmind: { open: jest.Mock } = jest.requireMock('maxmind');
      maxmind.open.mockResolvedValueOnce({
        get: jest.fn().mockImplementation(() => {
          throw new Error('GeoIP lookup failed');
        }),
      });

      await service.onModuleInit();

      const data: ClickJobData = {
        urlId: 'url-id',
        identifierId: 'identifier-1',
        shortCode: 'abc123',
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
        ip: '192.168.1.1',
      };

      await service.processClick(data);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          country: null,
        }),
      );
    });

    it('returns null when country is not available', async () => {
      const maxmind: { open: jest.Mock } = jest.requireMock('maxmind');
      maxmind.open.mockResolvedValueOnce({
        get: jest.fn().mockReturnValue({ country: null }),
      });

      await service.onModuleInit();

      const data: ClickJobData = {
        urlId: 'url-id',
        identifierId: 'identifier-1',
        shortCode: 'abc123',
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
        ip: '192.168.1.1',
      };

      await service.processClick(data);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          country: null,
        }),
      );
    });
  });
});
