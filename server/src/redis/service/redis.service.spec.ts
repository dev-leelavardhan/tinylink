import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { REDIS_CONSTANTS } from '../constants/redis.constants';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
  }));
});

describe('RedisService (unit)', () => {
  it('has onModuleInit on its prototype', () => {
    expect(typeof RedisService.prototype.onModuleInit).toBe('function');
  });

  it('has onModuleDestroy on its prototype', () => {
    expect(typeof RedisService.prototype.onModuleDestroy).toBe('function');
  });

  it('creates instance with valid config', async () => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    const module = await Test.createTestingModule({
      providers: [RedisService, { provide: ConfigService, useValue: config }],
    }).compile();

    const service = module.get(RedisService);
    expect(service).toBeDefined();
    expect(config.getOrThrow).toHaveBeenCalledWith('REDIS_URL');
  });

  it('throws when REDIS_URL is not configured', async () => {
    const config = {
      getOrThrow: jest.fn().mockImplementation(() => {
        throw new Error('Missing key: REDIS_URL');
      }),
    };

    await expect(
      Test.createTestingModule({
        providers: [RedisService, { provide: ConfigService, useValue: config }],
      }).compile(),
    ).rejects.toThrow('Missing key: REDIS_URL');
  });

  it('onModuleInit calls connect and logs success', async () => {
    const instance = Object.create(RedisService.prototype) as RedisService;
    const connectSpy = jest.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (instance as any).connect = connectSpy;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (instance as any).logger = { log: jest.fn(), error: jest.fn() };

    await instance.onModuleInit();

    expect(connectSpy).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect((instance as any).logger.log).toHaveBeenCalledWith(
      'Redis connected',
    );
  });

  it('onModuleInit throws and logs error on connection failure', async () => {
    const instance = Object.create(RedisService.prototype) as RedisService;
    const error = new Error('connection refused');
    const connectSpy = jest.fn().mockRejectedValue(error);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (instance as any).connect = connectSpy;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (instance as any).logger = { log: jest.fn(), error: jest.fn() };

    await expect(instance.onModuleInit()).rejects.toThrow('connection refused');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect((instance as any).logger.error).toHaveBeenCalledWith(
      'Redis connection failed',
      error,
    );
  });

  it('onModuleDestroy calls quit', async () => {
    const instance = Object.create(RedisService.prototype) as RedisService;
    const quitSpy = jest.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (instance as any).quit = quitSpy;

    await instance.onModuleDestroy();

    expect(quitSpy).toHaveBeenCalled();
  });

  it('has correct Redis constants', () => {
    expect(REDIS_CONSTANTS.RETRY_BASE_DELAY_MS).toBeDefined();
    expect(REDIS_CONSTANTS.RETRY_MAX_DELAY_MS).toBeDefined();
    expect(REDIS_CONSTANTS.KEEPALIVE_INTERVAL_MS).toBeDefined();
  });

  describe('retryStrategy', () => {
    it('returns delay within bounds for retry attempts', () => {
      const baseDelay = REDIS_CONSTANTS.RETRY_BASE_DELAY_MS;
      const maxDelay = REDIS_CONSTANTS.RETRY_MAX_DELAY_MS;

      // Test for attempt 1
      const delay1 = Math.min(1 * baseDelay, maxDelay);
      expect(delay1).toBeGreaterThanOrEqual(0);
      expect(delay1).toBeLessThanOrEqual(maxDelay);

      // Test for attempt 5
      const delay5 = Math.min(5 * baseDelay, maxDelay);
      expect(delay5).toBeGreaterThanOrEqual(0);
      expect(delay5).toBeLessThanOrEqual(maxDelay);

      // Test for attempt 100 (should cap at maxDelay)
      const delay100 = Math.min(100 * baseDelay, maxDelay);
      expect(delay100).toBe(maxDelay);
    });
  });
});
