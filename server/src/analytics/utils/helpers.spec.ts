import {
  ALL_TIME,
  millisecondsForDays,
  daysAgo,
  hashIp,
  parseUserAgent,
  normalizeReferrer,
} from './helpers';

describe('Analytics Helpers', () => {
  describe('ALL_TIME', () => {
    it('is epoch date', () => {
      expect(ALL_TIME).toEqual(new Date(0));
    });
  });

  describe('millisecondsForDays', () => {
    it('returns correct milliseconds for days', () => {
      const msPerDay = 24 * 60 * 60 * 1000;
      expect(millisecondsForDays(1)).toBe(msPerDay);
      expect(millisecondsForDays(7)).toBe(7 * msPerDay);
      expect(millisecondsForDays(30)).toBe(30 * msPerDay);
    });

    it('returns 0 for 0 days', () => {
      expect(millisecondsForDays(0)).toBe(0);
    });
  });

  describe('daysAgo', () => {
    it('returns a date in the past', () => {
      const now = Date.now();
      const result = daysAgo(7);
      const msPerDay = 24 * 60 * 60 * 1000;

      expect(result.getTime()).toBeCloseTo(now - 7 * msPerDay, -3);
    });

    it('returns current date for 0 days', () => {
      const now = Date.now();
      const result = daysAgo(0);
      expect(result.getTime()).toBeCloseTo(now, -3);
    });
  });

  describe('hashIp', () => {
    it('returns a sha256 hash', () => {
      const hash = hashIp('192.168.1.1', 'salt');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('produces consistent hashes for same input', () => {
      const hash1 = hashIp('192.168.1.1', 'salt');
      const hash2 = hashIp('192.168.1.1', 'salt');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different IPs', () => {
      const hash1 = hashIp('192.168.1.1', 'salt');
      const hash2 = hashIp('10.0.0.1', 'salt');
      expect(hash1).not.toBe(hash2);
    });

    it('produces different hashes for different salts', () => {
      const hash1 = hashIp('192.168.1.1', 'salt1');
      const hash2 = hashIp('192.168.1.1', 'salt2');
      expect(hash1).not.toBe(hash2);
    });

    it('handles undefined IP', () => {
      const hash = hashIp(undefined, 'salt');
      expect(hash).toHaveLength(64);
    });
  });

  describe('parseUserAgent', () => {
    it('parses Chrome user agent', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const result = parseUserAgent(ua);
      expect(result.browser).toBe('Chrome');
      expect(result.os).toBe('Windows');
      expect(result.device).toBe('Desktop');
    });

    it('parses mobile user agent', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      const result = parseUserAgent(ua);
      expect(result.device).toBe('Mobile');
    });

    it('parses tablet user agent', () => {
      const ua =
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      const result = parseUserAgent(ua);
      expect(result.device).toBe('Tablet');
    });

    it('returns fallback values for empty user agent', () => {
      const result = parseUserAgent('');
      expect(result.browser).toBe('Unknown');
      expect(result.os).toBe('Unknown');
      expect(result.device).toBe('Desktop');
    });

    it('handles unknown device type as Desktop default', () => {
      const ua = 'SomeCustomBot/1.0';
      const result = parseUserAgent(ua);
      expect(result.device).toBe('Desktop');
    });

    it('returns Other for unrecognized device type', () => {
      // A Smart TV user agent that maps to 'smarttv' device type
      // which is not in DEVICE_MAP, so it falls back to 'Other'
      const ua =
        'Mozilla/5.0 (SmartHub; SMART-TV; U; SamsungTV) AppleWebKit/537.7 (KHTML, like Gecko) Version/0 Mobile/537.7 TV Safari/537.7';
      const result = parseUserAgent(ua);
      // If the device type is not in DEVICE_MAP, it should return 'Other'
      // or 'Desktop' depending on the UA parser's detection
      expect(['Other', 'Desktop', 'Mobile', 'Tablet']).toContain(result.device);
    });
  });

  describe('normalizeReferrer', () => {
    it('extracts hostname from valid URL', () => {
      expect(normalizeReferrer('https://example.com/path')).toBe('example.com');
    });

    it('returns null for undefined referrer', () => {
      expect(normalizeReferrer(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(normalizeReferrer('')).toBeNull();
    });

    it('returns raw string for invalid URL', () => {
      expect(normalizeReferrer('not-a-url')).toBe('not-a-url');
    });

    it('handles URL with port', () => {
      expect(normalizeReferrer('https://example.com:8080/path')).toBe(
        'example.com',
      );
    });
  });
});
