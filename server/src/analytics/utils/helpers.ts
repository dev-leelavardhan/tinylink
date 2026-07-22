import { createHash } from 'crypto';
import * as UAParser from 'ua-parser-js';

// ============================================================================
// Types
// ============================================================================

export type DeviceType = 'Desktop' | 'Mobile' | 'Tablet' | 'Other';

export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: DeviceType;
}

// ============================================================================
// Constants
// ============================================================================

const MILLISECONDS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

const MILLISECONDS_PER_DAY =
  MILLISECONDS_PER_SECOND *
  SECONDS_PER_MINUTE *
  MINUTES_PER_HOUR *
  HOURS_PER_DAY;

const DEVICE_MAP: Record<string, DeviceType> = {
  desktop: 'Desktop',
  mobile: 'Mobile',
  tablet: 'Tablet',
};

// ============================================================================
// Time Utilities
// ============================================================================

export const ALL_TIME = new Date(0);

export function millisecondsForDays(days: number): number {
  return days * MILLISECONDS_PER_DAY;
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - millisecondsForDays(days));
}

// ============================================================================
// Security Utilities
// ============================================================================

export function hashIp(ip: string | undefined, salt: string): string {
  return createHash('sha256')
    .update(`${salt}${ip ?? ''}`)
    .digest('hex');
}

// ============================================================================
// User-Agent Utilities
// ============================================================================

export function parseUserAgent(userAgent: string): ParsedUserAgent {
  const parser = new UAParser.UAParser(userAgent);

  const browser = parser.getBrowser().name ?? 'Unknown';
  const os = parser.getOS().name ?? 'Unknown';
  const deviceType = parser.getDevice().type ?? 'desktop';

  return {
    browser,
    os,
    device: DEVICE_MAP[deviceType] ?? 'Other',
  };
}

// ============================================================================
// URL Utilities
// ============================================================================

export function normalizeReferrer(referrer?: string): string | null {
  if (!referrer) {
    return null;
  }

  try {
    return new URL(referrer).hostname;
  } catch {
    return referrer;
  }
}
