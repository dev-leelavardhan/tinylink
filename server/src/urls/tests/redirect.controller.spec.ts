import { Test, TestingModule } from '@nestjs/testing';

import { RedirectController } from '../urls.controller';
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

    const result = await controller.redirect('abc123');

    expect(result).toEqual({ url: 'https://destination.example' });
    expect(urlsService.redirect).toHaveBeenCalledWith('abc123');
  });
});
