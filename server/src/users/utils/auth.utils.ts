import { createHash } from 'crypto';
import { type Response } from 'express';

import { USER_CONSTANTS } from '../constants/user.constants';

// ============================================================================
// Constants
// ============================================================================

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// ============================================================================
// Time Utilities
// ============================================================================

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * MILLISECONDS_PER_DAY);
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * MILLISECONDS_PER_DAY);
}

// ============================================================================
// Email Utilities
// ============================================================================

export function normalizeEmail(email: string): string {
  // Canonicalize consistently across every flow (register, verify, login,
  // forgot, reset): trim + lowercase only. Provider-specific rules (e.g. Gmail
  // dot/plus stripping) are intentionally NOT applied, so the value always
  // matches what registration/verification stored.
  return email.trim().toLowerCase();
}

// ============================================================================
// Token Utilities
// ============================================================================

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ============================================================================
// User Agent Utilities
// ============================================================================

export function parseUserAgent(userAgent: string): {
  browser: string;
  os: string;
} {
  const browser = extractBrowser(userAgent);
  const os = extractOs(userAgent);

  return { browser, os };
}

function extractBrowser(userAgent: string): string {
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Edg/')) return 'Edge';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Opera') || userAgent.includes('OPR/')) return 'Opera';
  return 'Unknown';
}

function extractOs(userAgent: string): string {
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iPhone') || userAgent.includes('iOS')) return 'iOS';
  if (userAgent.includes('Mac OS')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  return 'Unknown';
}

// ============================================================================
// IP Address Utilities
// ============================================================================

/**
 * Resolve the client IP. Express is configured with `trust proxy = 1`
 * (see apply-middleware.ts), so `req.ip` already reflects the real client
 * address from the trusted proxy. We deliberately do NOT parse the raw
 * `X-Forwarded-For` header here because it is client-controlled and would let
 * callers spoof their IP to bypass IP-based rate limits.
 */
export function getClientIp(ip: string | undefined): string | undefined {
  return ip;
}

/**
 * Reduce the precision of a client IP before it is persisted as PII on the user
 * record (last-login metadata). IPv4 drops the final octet; IPv6 keeps only the
 * /48 routing prefix. This retains coarse "where did I last log in" signal for
 * security review while avoiding storage of a fully-identifying address (GDPR
 * data-minimisation). Analytics uses a separate salted hash.
 */
export function anonymizeIp(ip: string | undefined): string | undefined {
  if (!ip) return ip;

  if (ip.includes('.')) {
    const octets = ip.split('.');
    if (octets.length === 4) {
      octets[3] = '0';
      return octets.join('.');
    }
    return ip;
  }

  if (ip.includes(':')) {
    const groups = ip.split(':').filter((g) => g.length > 0);
    if (groups.length >= 3) {
      return `${groups.slice(0, 3).join(':')}::`;
    }
    return ip;
  }

  return ip;
}

// ============================================================================
// Cookie Utilities
// ============================================================================

export function setRefreshTokenCookie(
  res: Response,
  token: string,
  maxAgeMs: number = USER_CONSTANTS.SESSION_COOKIE_MAX_AGE_MS,
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie(USER_CONSTANTS.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: USER_CONSTANTS.SESSION_COOKIE_PATH,
    maxAge: maxAgeMs,
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  res.cookie(USER_CONSTANTS.SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: USER_CONSTANTS.SESSION_COOKIE_PATH,
    maxAge: 0,
  });
}

export function getRefreshTokenFromCookie(
  cookies: Record<string, string | undefined>,
): string | null {
  return cookies[USER_CONSTANTS.SESSION_COOKIE_NAME] ?? null;
}
