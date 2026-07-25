import { Test, TestingModule } from '@nestjs/testing';

import { UrlsController, RedirectController } from './urls.controller';
import { UrlsService } from '../service/urls.service';
import type { Request, Response } from 'express';

describe('UrlsController (unit)', () => {
  let controller: UrlsController;
  const urlsService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UrlsController],
      providers: [{ provide: UrlsService, useValue: urlsService }],
    }).compile();

    controller = module.get(UrlsController);
  });

  it('delegates URL creation to UrlsService', async () => {
    const dto = { originalUrl: 'https://example.com' };
    const response = {
      originalUrl: dto.originalUrl,
      shortCode: 'abc1234',
      shortUrl: 'http://localhost:3001/abc1234',
    };

    urlsService.create.mockResolvedValue(response);

    const req = {
      ip: '192.168.1.1',
      socket: { remoteAddress: '192.168.1.1' },
      user: undefined,
    } as unknown as Request & { user?: { userId: string } };

    await expect(controller.create(dto, req)).resolves.toEqual(response);
    expect(urlsService.create).toHaveBeenCalledWith(
      dto,
      undefined,
      '192.168.1.1',
    );
  });
});

describe('RedirectController (unit)', () => {
  let controller: RedirectController;
  const urlsService = {
    redirect: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RedirectController],
      providers: [{ provide: UrlsService, useValue: urlsService }],
    }).compile();

    controller = module.get(RedirectController);
  });

  it('redirects to original URL', async () => {
    urlsService.redirect.mockResolvedValue('https://example.com');

    const req = {
      ip: '192.168.1.1',
      headers: {
        'user-agent': 'Mozilla/5.0',
        referer: 'https://referrer.com',
      },
      socket: { remoteAddress: '192.168.1.1' },
    } as unknown as Request;

    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;

    const result = await controller.redirect('test-code', req, res);

    expect(result).toEqual({ url: 'https://example.com' });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-store, no-cache, must-revalidate',
    );
    expect(urlsService.redirect).toHaveBeenCalledWith('test-code', {
      userAgent: 'Mozilla/5.0',
      referrer: 'https://referrer.com',
      ip: '192.168.1.1',
    });
  });

  it('uses socket.remoteAddress when ip is undefined', async () => {
    urlsService.redirect.mockResolvedValue('https://example.com');

    const req = {
      ip: undefined,
      headers: {
        'user-agent': 'Mozilla/5.0',
      },
      socket: { remoteAddress: '10.0.0.1' },
    } as unknown as Request;

    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;

    const result = await controller.redirect('test-code', req, res);

    expect(result).toEqual({ url: 'https://example.com' });
    expect(urlsService.redirect).toHaveBeenCalledWith('test-code', {
      userAgent: 'Mozilla/5.0',
      referrer: undefined,
      ip: '10.0.0.1',
    });
  });

  it('handles missing ip and socket', async () => {
    urlsService.redirect.mockResolvedValue('https://example.com');

    const req = {
      ip: undefined,
      headers: {},
      socket: undefined,
    } as unknown as Request;

    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;

    const result = await controller.redirect('test-code', req, res);

    expect(result).toEqual({ url: 'https://example.com' });
    expect(urlsService.redirect).toHaveBeenCalledWith('test-code', {
      userAgent: '',
      referrer: undefined,
      ip: undefined,
    });
  });

  it('handles missing user-agent header', async () => {
    urlsService.redirect.mockResolvedValue('https://example.com');

    const req = {
      ip: '192.168.1.1',
      headers: {},
      socket: { remoteAddress: '192.168.1.1' },
    } as unknown as Request;

    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;

    const result = await controller.redirect('test-code', req, res);

    expect(result).toEqual({ url: 'https://example.com' });
    expect(urlsService.redirect).toHaveBeenCalledWith('test-code', {
      userAgent: '',
      referrer: undefined,
      ip: '192.168.1.1',
    });
  });
});
