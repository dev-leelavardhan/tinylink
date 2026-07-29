import type { Request, Response, NextFunction } from 'express';

/**
 * CSRF protection for cookie-based endpoints.
 *
 * Validates that the Origin header matches the application's base URL.
 * This prevents cross-site request forgery attacks on cookie-authenticated endpoints.
 */
export function CsrfProtectionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const baseUrl = process.env.BASE_URL;

  // Skip in non-production modes (development, test)
  if (process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  // Fail hard if BASE_URL is missing in production/staging
  if (!baseUrl) {
    res.status(500).json({
      statusCode: 500,
      message: 'CSRF protection misconfigured: BASE_URL not set',
    });
    return;
  }

  // Only check Origin header (Referer is spoofable and unreliable)
  const origin = req.headers.origin;

  if (!origin) {
    res.status(403).json({
      statusCode: 403,
      message: 'CSRF validation failed: missing Origin header',
    });
    return;
  }

  try {
    const originUrl = new URL(
      Array.isArray(origin) ? String(origin[0] ?? '') : String(origin),
    );
    const baseUrlObj = new URL(baseUrl);

    if (originUrl.origin !== baseUrlObj.origin) {
      res.status(403).json({
        statusCode: 403,
        message: 'CSRF validation failed: origin mismatch',
      });
      return;
    }
  } catch {
    res.status(403).json({
      statusCode: 403,
      message: 'CSRF validation failed: invalid origin',
    });
    return;
  }

  next();
}
