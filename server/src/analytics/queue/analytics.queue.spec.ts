import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { AnalyticsQueue } from './analytics.queue';

jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({}),
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('AnalyticsQueue', () => {
  let queue: AnalyticsQueue;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsQueue,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('redis://localhost:6379'),
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    queue = module.get<AnalyticsQueue>(AnalyticsQueue);
  });

  it('should be defined', () => {
    expect(queue).toBeDefined();
  });

  it('has add method', () => {
    expect(typeof queue.add).toBe('function');
  });

  it('closes queue on module destroy', async () => {
    // Call onModuleDestroy directly on the class prototype since the mock
    // doesn't properly set up the extends chain
    const closeSpy = jest.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (queue as any).close = closeSpy;

    // Call the method directly since the mock breaks the prototype chain
    await AnalyticsQueue.prototype.onModuleDestroy.call(queue);

    expect(closeSpy).toHaveBeenCalled();
  });
});
