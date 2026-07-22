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
    updateLastAccessedAt: jest.Mock;
  };
  let config: {
    getOrThrow: jest.Mock;
  };
  let logger: {
    setContext: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn().mockResolvedValue({}),
      updateLastAccessedAt: jest.fn().mockResolvedValue({}),
    };

    config = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key === 'IP_HASH_SALT') return 'test-salt';
        if (key === 'GEOLITE2_DB_PATH') return './test.mmdb';
        return null;
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
  });

  describe('processClick', () => {
    it('creates analytics record with correct data', async () => {
      await service.onModuleInit();

      const data: ClickJobData = {
        urlId: 'url-id',
        shortCode: 'abc123',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        referrer: 'https://example.com/page',
        ip: '192.168.1.1',
      };

      await service.processClick(data);

      expect(repository.create).toHaveBeenCalledWith({
        url: { connect: { id: 'url-id' } },
        browser: 'Chrome',
        os: 'Windows',
        device: 'Desktop',
        country: 'US',
        ipHash: expect.any(String) as string,
        referrer: 'example.com',
      });
    });

    it('updates lastAccessedAt after creating record', async () => {
      await service.onModuleInit();

      const data: ClickJobData = {
        urlId: 'url-id',
        shortCode: 'abc123',
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
        ip: '192.168.1.1',
      };

      await service.processClick(data);

      expect(repository.updateLastAccessedAt).toHaveBeenCalledWith('url-id');
    });

    it('handles missing IP', async () => {
      await service.onModuleInit();

      const data: ClickJobData = {
        urlId: 'url-id',
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
  });
});
