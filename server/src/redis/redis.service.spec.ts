import { RedisService } from './redis.service';

describe('RedisService (unit)', () => {
  it('has onModuleInit on its prototype', () => {
    expect(typeof RedisService.prototype.onModuleInit).toBe('function');
  });

  it('has onModuleDestroy on its prototype', () => {
    expect(typeof RedisService.prototype.onModuleDestroy).toBe('function');
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
});
