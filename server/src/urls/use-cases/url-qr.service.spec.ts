import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import QRCode from 'qrcode';

import { UrlQrService } from './url-qr.service';
import { UrlRepository } from '../repositories/url.repository';
import { QR_ERROR_MESSAGES } from '../constants/qr.constants';

jest.mock('qrcode', () => ({
  toString: jest.fn().mockResolvedValue('<svg></svg>'),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-png')),
}));

describe('UrlQrService', () => {
  let service: UrlQrService;
  let urlRepository: {
    findByShortCodeOrAlias: jest.Mock;
  };
  let config: {
    getOrThrow: jest.Mock;
  };

  beforeEach(async () => {
    urlRepository = {
      findByShortCodeOrAlias: jest.fn(),
    };

    config = {
      getOrThrow: jest.fn().mockReturnValue('https://short.ly'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlQrService,
        { provide: UrlRepository, useValue: urlRepository },
        { provide: ConfigService, useValue: config },
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            info: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UrlQrService>(UrlQrService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generate', () => {
    it('generates PNG QR code for existing URL', async () => {
      urlRepository.findByShortCodeOrAlias.mockResolvedValue({
        id: 'url-1',
        shortCode: 'abc1234',
        originalUrl: 'https://example.com',
      });

      const result = await service.generate('abc1234', 'png', 300);

      expect(urlRepository.findByShortCodeOrAlias).toHaveBeenCalledWith(
        'abc1234',
      );
      expect(QRCode.toBuffer).toHaveBeenCalledWith('https://short.ly/abc1234', {
        type: 'png',
        width: 300,
      });
      expect(result.contentType).toBe('image/png');
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('generates SVG QR code for existing URL', async () => {
      urlRepository.findByShortCodeOrAlias.mockResolvedValue({
        id: 'url-1',
        shortCode: 'abc1234',
        originalUrl: 'https://example.com',
      });

      const result = await service.generate('abc1234', 'svg', 400);

      expect(QRCode.toString).toHaveBeenCalledWith('https://short.ly/abc1234', {
        type: 'svg',
        width: 400,
      });
      expect(result.contentType).toBe('image/svg+xml');
    });

    it('throws NotFoundException for non-existent URL', async () => {
      urlRepository.findByShortCodeOrAlias.mockResolvedValue(null);

      await expect(service.generate('nonexistent', 'png', 300)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException with correct error message', async () => {
      urlRepository.findByShortCodeOrAlias.mockResolvedValue(null);

      try {
        await service.generate('nonexistent', 'png', 300);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as NotFoundException).message).toBe(
          QR_ERROR_MESSAGES.URL_NOT_FOUND,
        );
      }
    });

    it('uses custom alias for QR content when alias exists', async () => {
      urlRepository.findByShortCodeOrAlias.mockResolvedValue({
        id: 'url-1',
        shortCode: 'abc1234',
        customAlias: 'myalias',
        originalUrl: 'https://example.com',
      });

      await service.generate('myalias', 'png', 300);

      expect(QRCode.toBuffer).toHaveBeenCalledWith('https://short.ly/abc1234', {
        type: 'png',
        width: 300,
      });
    });
  });
});
