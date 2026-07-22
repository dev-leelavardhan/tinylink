import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';

import { RedirectController } from './urls.controller';
import { UrlsService } from '../service/urls.service';

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

  it('returns the redirect URL for a valid short code', async () => {
    urlsService.redirect.mockResolvedValue('https://destination.example');

    const mockReq = {
      headers: { 'user-agent': 'test-agent', referer: 'https://example.com' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;

    const result = await controller.redirect('abc123', mockReq);

    expect(result).toEqual({ url: 'https://destination.example' });
    expect(urlsService.redirect).toHaveBeenCalledWith('abc123', {
      userAgent: 'test-agent',
      referrer: 'https://example.com',
      ip: '127.0.0.1',
    });
  });
});
