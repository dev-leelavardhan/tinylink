import { Test, TestingModule } from '@nestjs/testing';
import { StreamableFile } from '@nestjs/common';
import { QrController } from './qr.controller';
import { UrlsService } from '../service/urls.service';

describe('QrController', () => {
  let controller: QrController;
  let urlsService: {
    getQrCode: jest.Mock;
  };

  beforeEach(async () => {
    urlsService = {
      getQrCode: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QrController],
      providers: [{ provide: UrlsService, useValue: urlsService }],
    }).compile();

    controller = module.get<QrController>(QrController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getQrCode', () => {
    it('delegates to urlsService.getQrCode with correct params', async () => {
      const expected = {
        buffer: Buffer.from('fake-png'),
        contentType: 'image/png',
      };
      urlsService.getQrCode.mockResolvedValue(expected);

      const setHeaderFn = jest.fn();
      const mockRes = { setHeader: setHeaderFn };

      const result = await controller.getQrCode(
        'abc1234',
        { format: 'png', size: 300 },
        mockRes as never,
      );

      expect(urlsService.getQrCode).toHaveBeenCalledWith('abc1234', 'png', 300);
      expect(setHeaderFn).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(result).toBeInstanceOf(StreamableFile);
    });

    it('sets SVG content type for svg format', async () => {
      const expected = {
        buffer: Buffer.from('<svg></svg>'),
        contentType: 'image/svg+xml',
      };
      urlsService.getQrCode.mockResolvedValue(expected);

      const setHeaderFn = jest.fn();
      const mockRes = { setHeader: setHeaderFn };

      await controller.getQrCode(
        'abc1234',
        { format: 'svg', size: 400 },
        mockRes as never,
      );

      expect(setHeaderFn).toHaveBeenCalledWith('Content-Type', 'image/svg+xml');
    });
  });
});
