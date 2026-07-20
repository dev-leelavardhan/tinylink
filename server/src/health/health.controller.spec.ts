import { Test, TestingModule } from '@nestjs/testing';

import { HealthService } from './health.service';
import { HealthController } from './health.controller';

describe('HealthController (unit)', () => {
  let controller: HealthController;
  const healthService = {
    check: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('delegates check to HealthService', async () => {
    const expected = { status: 'ok', db: 'up' };
    healthService.check.mockResolvedValue(expected);

    const result = await controller.check();

    expect(result).toEqual(expected);
    expect(healthService.check).toHaveBeenCalledTimes(1);
  });
});
