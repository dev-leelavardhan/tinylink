import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { UsersModule } from './users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { UserRepository } from './repositories/user.repository';
import { SessionRepository } from './repositories/session.repository';
import { RedisService } from '../redis/service/redis.service';
import { MailerService } from '../mailer/mailer.service';
import { ThrottlerStorageModule } from '../common/throttler/throttler-storage.module';
import { ThrottlerRedisStorage } from '../common/throttler/throttler-redis-storage';

const testConfig = {
  JWT_ACCESS_SECRET: 'test-access-secret-min-32-chars-long!!',
  JWT_REFRESH_SECRET: 'test-refresh-secret-min-32-chars-long!',
  DATABASE_URL: 'postgresql://localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  MAILER_HOST: 'smtp.example.com',
  MAILER_USER: 'user',
  MAILER_PASS: 'pass',
  MAILER_FROM: 'noreply@example.com',
};

const prismaMock = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  session: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  verificationOtp: {
    create: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
};

const redisMock = {
  setex: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(1),
  incr: jest.fn().mockResolvedValue(1),
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue('OK'),
  connect: jest.fn().mockResolvedValue(undefined),
  eval: jest.fn().mockResolvedValue([1, 60000, 0, 0]),
  multi: jest.fn().mockReturnValue({
    incr: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    pttl: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([
      [null, 1],
      [null, 60000],
    ]),
  }),
};

const mailerMock = {
  sendMail: jest.fn().mockResolvedValue(undefined),
};

describe('UsersModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          load: [() => testConfig],
        }),
        ThrottlerModule.forRootAsync({
          imports: [ThrottlerStorageModule],
          inject: [ThrottlerRedisStorage],
          useFactory: (storage: ThrottlerRedisStorage) => ({
            storage,
            throttlers: [{ ttl: 60000, limit: 60 }],
          }),
        }),
        LoggerModule.forRoot({
          pinoHttp: { transport: { target: 'pino-pretty' } },
        }),
        PrismaModule,
        UsersModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideProvider(MailerService)
      .useValue(mailerMock)
      .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('provides UserRepository', () => {
    expect(module.get(UserRepository)).toBeDefined();
  });

  it('provides SessionRepository', () => {
    expect(module.get(SessionRepository)).toBeDefined();
  });
});
