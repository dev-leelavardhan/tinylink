import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const expressApp = express();

  // BUG-018: Trust proxy - set to 1 for single proxy layer
  expressApp.set('trust proxy', 1);

  // BUG-017: Configure body parser limits
  expressApp.use(express.json({ limit: '1mb' }));

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
