import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { HttpsRedirectMiddleware } from '../middleware/https-redirect.middleware';
import { CsrfProtectionMiddleware } from '../middleware/csrf-protection.middleware';

/**
 * Applies all security and middleware to an Express app.
 * Shared between production bootstrap and E2E tests.
 */
export function applyMiddleware(expressApp: express.Express): void {
  // Trust proxy
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
        maxAge: 31536000,
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

  // Cookie parser (required for refresh token cookies)
  expressApp.use(cookieParser());
}
