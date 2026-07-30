import { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';

import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { applyMiddleware } from '../../src/common/bootstrap/apply-middleware';

export async function createTestApp(): Promise<INestApplication> {
  const expressApp = express();
  applyMiddleware(expressApp);

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication(
    new ExpressAdapter(expressApp),
    { bufferLogs: true },
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  await app.init();

  return app;
}
