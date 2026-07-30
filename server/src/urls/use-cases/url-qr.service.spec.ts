import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import QRCode from 'qrcode';

import { UrlQrService } from './url-qr.service';
import { IdentifierRepository } from '../repositories/identifier.repository';
import { QR_ERROR_MESSAGES } from '../constants/qr.constants';

jest.mock('qrcode', () => ({
  toString: jest.fn().mockResolvedValue('<svg></svg>'),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-png')),
}));

describe('UrlQrService', () => {
  let service: UrlQrService;
  let identifierRepository: {
    findByIdentifierCode: jest.Mock;
  };
  let config: {
    getOrThrow: jest.Mock;
  };

  beforeEach(async () => {
    identifierRepository = {
      findByIdentifierCode: jest.fn(),
    };

    config = {
      getOrThrow: jest.fn().mockReturnValue('https://short.ly'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlQrService,
        { provide: IdentifierRepository, useValue: identifierRepository },
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
    it('generates PNG QR code for existing identifier', async () => {
      identifierRepository.findByIdentifierCode.mockResolvedValue({
        id: 'id-1',
        code: 'abc1234',
        deletedAt: null,
      });

      const result = await service.generate('abc1234', 'png', 300);

      expect(identifierRepository.findByIdentifierCode).toHaveBeenCalledWith(
        'abc1234',
      );
      expect(QRCode.toBuffer).toHaveBeenCalledWith('https://short.ly/abc1234', {
        type: 'png',
        width: 300,
      });
      expect(result.contentType).toBe('image/png');
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('generates SVG QR code for existing identifier', async () => {
      identifierRepository.findByIdentifierCode.mockResolvedValue({
        id: 'id-1',
        code: 'abc1234',
        deletedAt: null,
      });

      const result = await service.generate('abc1234', 'svg', 400);

      expect(QRCode.toString).toHaveBeenCalledWith('https://short.ly/abc1234', {
        type: 'svg',
        width: 400,
      });
      expect(result.contentType).toBe('image/svg+xml');
    });

    it('throws NotFoundException for non-existent identifier', async () => {
      identifierRepository.findByIdentifierCode.mockResolvedValue(null);

      await expect(service.generate('nonexistent', 'png', 300)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for soft-deleted identifier', async () => {
      identifierRepository.findByIdentifierCode.mockResolvedValue({
        id: 'id-1',
        code: 'deleted',
        deletedAt: new Date(),
      });

      await expect(service.generate('deleted', 'png', 300)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException with correct error message', async () => {
      identifierRepository.findByIdentifierCode.mockResolvedValue(null);

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

    it('uses identifier code for QR content', async () => {
      identifierRepository.findByIdentifierCode.mockResolvedValue({
        id: 'id-1',
        code: 'abc1234',
        deletedAt: null,
      });

      await service.generate('abc1234', 'png', 300);

      expect(QRCode.toBuffer).toHaveBeenCalledWith('https://short.ly/abc1234', {
        type: 'png',
        width: 300,
      });
    });
  });
});
