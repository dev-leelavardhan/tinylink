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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (instance as any).$connect = connectSpy;

    await instance.onModuleInit();

    expect(connectSpy).toHaveBeenCalled();
  });

  it('onModuleDestroy calls pool.end then $disconnect', async () => {
    const instance = Object.create(PrismaService.prototype) as PrismaService;
    const poolEndSpy = jest.fn().mockResolvedValue(undefined);
    const disconnectSpy = jest.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (instance as any).pool = { end: poolEndSpy };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (instance as any).$disconnect = disconnectSpy;

    await instance.onModuleDestroy();

    expect(poolEndSpy).toHaveBeenCalled();
    expect(disconnectSpy).toHaveBeenCalled();
  });
});
