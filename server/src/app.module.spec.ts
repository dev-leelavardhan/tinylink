import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

const prismaMock = {
  url: { findFirst: jest.fn(), create: jest.fn() },
  $queryRaw: jest.fn(),
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

describe('AppModule (unit)', () => {
  let module: TestingModule;

  beforeEach(async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
    process.env.BASE_URL = 'http://localhost:3000';

    module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('provides AppController', () => {
    expect(module.get(AppController)).toBeDefined();
  });

  it('provides AppService', () => {
    expect(module.get(AppService)).toBeDefined();
  });
});
