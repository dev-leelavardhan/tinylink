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
});
