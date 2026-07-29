import type { Request, Response, NextFunction } from 'express';

/**
 * Resolve the host to redirect to. Prefer the configured BASE_URL host so an
 * attacker-supplied Host header cannot turn the HTTPS upgrade into an open
 * redirect to an arbitrary domain. Fall back to the request Host only when
 * BASE_URL is not configured (e.g. local dev).
 */
function resolveRedirectHost(req: Request): string | undefined {
  const baseUrl = process.env.BASE_URL;
  if (baseUrl) {
    try {
      return new URL(baseUrl).host;
    } catch {
      // Misconfigured BASE_URL — fall through to the request host.
    }
  }
  return req.headers.host;
}

export function HttpsRedirectMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Check if the request is already secure
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

  if (!isSecure) {
    const host = resolveRedirectHost(req);
    const httpsUrl = `https://${host}${req.url}`;
    res.redirect(301, httpsUrl);
    return;
  }

  next();
}
