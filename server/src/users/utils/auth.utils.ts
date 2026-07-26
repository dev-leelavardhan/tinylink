import { createHash } from 'crypto';
import { type Response } from 'express';

import { USER_CONSTANTS } from '../constants/user.constants';

// ============================================================================
// Email Utilities
// ============================================================================

export function normalizeEmail(email: string): string {
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

export function getClientIp(
  headers: Record<string, string | string[] | undefined>,
  ip: string | undefined,
): string | undefined {
  const forwardedFor = headers['x-forwarded-for'];
  if (forwardedFor) {
    const ipStr = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const firstIp = ipStr.split(',')[0].trim();
    if (firstIp) return firstIp;
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
    sameSite: 'lax',
    path: USER_CONSTANTS.SESSION_COOKIE_PATH,
    maxAge: maxAgeMs,
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  res.cookie(USER_CONSTANTS.SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: USER_CONSTANTS.SESSION_COOKIE_PATH,
    maxAge: 0,
  });
}

export function getRefreshTokenFromCookie(
  cookies: Record<string, string | undefined>,
): string | null {
  return cookies[USER_CONSTANTS.SESSION_COOKIE_NAME] ?? null;
}
