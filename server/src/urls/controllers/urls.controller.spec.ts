import { Test, TestingModule } from '@nestjs/testing';

import { UrlsController } from './urls.controller';
import { UrlsService } from '../service/urls.service';

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

    await expect(controller.create(dto)).resolves.toEqual(response);
    expect(urlsService.create).toHaveBeenCalledWith(dto);
  });
});
