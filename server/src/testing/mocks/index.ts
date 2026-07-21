import { PinoLogger } from 'nestjs-pino';

export type { PrismaService } from '../../prisma/prisma.service';
export type { RedisService } from '../../redis/redis.service';

export type PrismaMock = {
  url: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
  $queryRaw: jest.Mock;
  $queryRawUnsafe: jest.Mock;
  $executeRawUnsafe: jest.Mock;
  $connect: jest.Mock;
  $disconnect: jest.Mock;
};

export function createPrismaMock(): PrismaMock {
  return {
    url: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
}

export type RedisMock = {
  ping: jest.Mock;
  get: jest.Mock;
  setex: jest.Mock;
  del: jest.Mock;
  quit: jest.Mock;
  connect: jest.Mock;
};

export function createRedisMock(): RedisMock {
  return {
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn(),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    connect: jest.fn().mockResolvedValue(undefined),
  };
}

export function createLoggerMock(): Pick<
  PinoLogger,
  'setContext' | 'debug' | 'info' | 'warn' | 'error'
> {
  const logger = {
    setContext: jest.fn().mockReturnThis(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  return logger;
}

export function createConfigMock(values: Record<string, unknown> = {}): {
  get: jest.Mock;
  getOrThrow: jest.Mock;
} {
  const defaults: Record<string, unknown> = {
    BASE_URL: 'http://localhost:3001/',
    SHORT_CODE_STRATEGY: 'random',
    SHORT_CODE_LENGTH: 7,
    ...values,
  };

  return {
    get: jest.fn((key: string, defaultValue?: unknown) =>
      key in defaults ? defaults[key] : defaultValue,
    ),
    getOrThrow: jest.fn((key: string) => {
      if (!(key in defaults)) {
        throw new Error(`Missing config key: ${key}`);
      }
      return defaults[key];
    }),
  };
}
