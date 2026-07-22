import { createHash } from 'crypto';
import * as UAParser from 'ua-parser-js';

export function hashIp(ip: string | undefined, salt: string): string {
  return createHash('sha256')
    .update(salt + (ip ?? ''))
    .digest('hex');
}

export function parseUserAgent(userAgent: string): {
  browser: string;
  os: string;
  device: string;
} {
  const parser = new UAParser.UAParser(userAgent);
  const browser = parser.getBrowser().name ?? 'Unknown';
  const os = parser.getOS().name ?? 'Unknown';
  const deviceType = parser.getDevice().type ?? 'desktop';
  const device =
    deviceType === 'desktop'
      ? 'Desktop'
      : deviceType === 'mobile'
        ? 'Mobile'
        : deviceType === 'tablet'
          ? 'Tablet'
          : 'Other';

  return { browser, os, device };
}

export function normalizeReferrer(referrer: string | undefined): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    return url.hostname;
  } catch {
    return referrer;
  }
}
