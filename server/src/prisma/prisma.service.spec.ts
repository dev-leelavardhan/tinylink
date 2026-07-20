import { PrismaService } from './prisma.service';

describe('PrismaService (unit)', () => {
  it('has onModuleInit on its prototype', () => {
    expect(typeof PrismaService.prototype.onModuleInit).toBe('function');
  });

  it('has onModuleDestroy on its prototype', () => {
    expect(typeof PrismaService.prototype.onModuleDestroy).toBe('function');
  });

  it('onModuleInit calls $connect', async () => {
    const instance = Object.create(PrismaService.prototype) as PrismaService;
    const connectSpy = jest.fn().mockResolvedValue(undefined);
    (instance as Record<string, unknown>).$connect = connectSpy;

    await instance.onModuleInit();

    expect(connectSpy).toHaveBeenCalled();
  });

  it('onModuleDestroy calls $disconnect', async () => {
    const instance = Object.create(PrismaService.prototype) as PrismaService;
    const disconnectSpy = jest.fn().mockResolvedValue(undefined);
    (instance as Record<string, unknown>).$disconnect = disconnectSpy;

    await instance.onModuleDestroy();

    expect(disconnectSpy).toHaveBeenCalled();
  });
});
