import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { UsersModule } from './users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { UserRepository } from './repositories/user.repository';

const prismaMock = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

describe('UsersModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, cache: true }),
        LoggerModule.forRoot({
          pinoHttp: { transport: { target: 'pino-pretty' } },
        }),
        PrismaModule,
        UsersModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
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
});
