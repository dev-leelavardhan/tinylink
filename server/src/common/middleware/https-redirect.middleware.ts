import type { Request, Response, NextFunction } from 'express';

export function HttpsRedirectMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Check if the request is already secure
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

  if (!isSecure) {
    const httpsUrl = `https://${req.headers.host}${req.url}`;
    res.redirect(301, httpsUrl);
    return;
  }

  next();
}
