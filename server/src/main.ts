import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { HttpsRedirectMiddleware } from './common/middleware/https-redirect.middleware';
import { CsrfProtectionMiddleware } from './common/middleware/csrf-protection.middleware';

async function bootstrap() {
  const expressApp = express();

  // Trust proxy - set to 1 for single proxy layer
  expressApp.set('trust proxy', 1);

  // Security headers (Helmet)
  expressApp.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // HTTPS enforcement in production
  if (process.env.NODE_ENV === 'production') {
    expressApp.use(HttpsRedirectMiddleware);
  }

  // CSRF protection for cookie-based endpoints
  expressApp.use('/auth/refresh', CsrfProtectionMiddleware);
  expressApp.use('/auth/logout', CsrfProtectionMiddleware);
  expressApp.use('/auth/logout-all', CsrfProtectionMiddleware);

  // Body parser limits
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
