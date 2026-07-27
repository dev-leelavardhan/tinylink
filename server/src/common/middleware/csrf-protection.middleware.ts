import type { Request, Response, NextFunction } from 'express';

/**
 * CSRF protection for cookie-based endpoints.
 *
 * Validates that the Origin or Referer header matches the application's base URL.
 * This prevents cross-site request forgery attacks on cookie-authenticated endpoints.
 */
export function CsrfProtectionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const baseUrl = process.env.BASE_URL;

  // Skip CSRF check in development if no BASE_URL is set
  if (!baseUrl || process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  const originHeader: string | string[] | undefined =
    req.headers.origin || req.headers.referer;

  if (!originHeader) {
    res.status(403).json({
      statusCode: 403,
      message: 'CSRF validation failed: missing Origin header',
    });
    return;
  }

  const originValue: string = Array.isArray(originHeader)
    ? String(originHeader[0] ?? '')
    : String(originHeader);

  try {
    const originUrl = new URL(originValue);
    const baseUrlObj = new URL(baseUrl);

    // Check if origin matches the base URL
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
