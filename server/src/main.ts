import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { applyMiddleware } from './common/bootstrap/apply-middleware';

async function bootstrap() {
  const expressApp = express();

  applyMiddleware(expressApp);

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { bufferLogs: true },
  );

  // CORS configuration
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : false,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: !!corsOrigin,
  });

  // Global exception filter (sanitizes errors in production)
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  app.get(Logger).log(`TinyLink API started on port ${port}`);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start TinyLink API', error);
  process.exit(1);
});
