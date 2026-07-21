import { RedisService } from './redis.service';

describe('RedisService (unit)', () => {
  it('has onModuleInit on its prototype', () => {
    expect(typeof RedisService.prototype.onModuleInit).toBe('function');
  });

  it('has onModuleDestroy on its prototype', () => {
    expect(typeof RedisService.prototype.onModuleDestroy).toBe('function');
  });

  it('onModuleInit calls connect', async () => {
    const instance = Object.create(RedisService.prototype) as RedisService;
    const connectSpy = jest.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (instance as any).connect = connectSpy;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (instance as any).logger = { log: jest.fn(), error: jest.fn() };

    await instance.onModuleInit();

    expect(connectSpy).toHaveBeenCalled();
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
