import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const expressApp = express();
  // Trust proxy for correct req.ip behind reverse proxies (nginx, etc.)
  expressApp.set('trust proxy', true);

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { bufferLogs: true },
  );

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
