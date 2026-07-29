import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

export const isUniqueConstraintOn = (
  error: PrismaClientKnownRequestError,
  fields: string[],
): boolean => {
  const target = error.meta?.target;
  if (!Array.isArray(target)) {
    return false;
  }

  return (
    fields.length === target.length &&
    fields.every((field) => target.includes(field))
  );
};

/**
 * Normalize a URL for deduplication.
 * - Lowercase protocol and host
 * - Remove trailing slash
 * - Remove default ports (80 for http, 443 for https)
 * - Remove common tracking params (utm_*, fbclid, gclid)
 * - Sort remaining query params
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Lowercase protocol and host
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove default ports
    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }

    // Remove trailing slash from pathname
    if (parsed.pathname === '/') {
      parsed.pathname = '';
    } else if (parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    // Remove tracking params (only well-known ad/tracking params)
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
    ];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }

    // Sort remaining params for consistency
    parsed.searchParams.sort();

    return parsed.toString();
  } catch {
    // If URL parsing fails, return as-is (trimmed + lowered)
    return url.trim().toLowerCase();
  }
}
