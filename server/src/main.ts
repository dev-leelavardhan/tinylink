// import 'dotenv/config'; needed only this for the dev env
// Tracing must be imported before any instrumented module is loaded.
import './tracing';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';

import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { applyMiddleware } from './common/bootstrap/apply-middleware';

const REQUEST_TIMEOUT_MS = 30_000;

async function bootstrap() {
  const expressApp = express();

  // Request timeout (Slowloris protection)
  expressApp.use((req, res, next) => {
    req.setTimeout(REQUEST_TIMEOUT_MS);
    res.setTimeout(REQUEST_TIMEOUT_MS);
    next();
  });

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
    allowedHeaders: 'Content-Type,Authorization,X-Request-Id',
    credentials: !!corsOrigin,
  });

  // Global exception filter (sanitizes errors in production)
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  // OpenAPI / Swagger UI at /docs (JSON at /docs-json). Disabled in production
  // so the full API surface isn't published publicly.
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('TinyLink API')
      .setDescription(
        'URL shortener API — links, redirects, auth and analytics.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('refresh_token')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  app.get(Logger).log(`TinyLink API started on port ${port}`);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start TinyLink API', error);
  process.exit(1);
});
