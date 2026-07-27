import type { Response } from 'express';

import {
  normalizeEmail,
  hashRefreshToken,
  parseUserAgent,
  getClientIp,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
} from './auth.utils';

describe('auth.utils', () => {
  describe('normalizeEmail', () => {
    it('should trim and lowercase email', () => {
      expect(normalizeEmail('  Test@Example.COM  ')).toBe('test@example.com');
    });

    it('should handle already normalized email', () => {
      expect(normalizeEmail('test@example.com')).toBe('test@example.com');
    });
  });

  describe('hashRefreshToken', () => {
    it('should hash token with SHA-256', () => {
      const token = 'test-refresh-token';
      const hash = hashRefreshToken(token);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('should produce consistent hashes', () => {
      const token = 'test-refresh-token';
      const hash1 = hashRefreshToken(token);
      const hash2 = hashRefreshToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashRefreshToken('token-1');
      const hash2 = hashRefreshToken('token-2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('parseUserAgent', () => {
    it('should parse Chrome on Windows', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      const result = parseUserAgent(ua);

      expect(result.browser).toBe('Chrome');
      expect(result.os).toBe('Windows');
    });

    it('should parse Firefox on macOS', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0';

      const result = parseUserAgent(ua);

      expect(result.browser).toBe('Firefox');
      expect(result.os).toBe('macOS');
    });

    it('should parse Safari on iOS', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

      const result = parseUserAgent(ua);

      expect(result.browser).toBe('Safari');
      expect(result.os).toBe('iOS');
    });

    it('should handle unknown user agent', () => {
      const result = parseUserAgent('Unknown');

      expect(result.browser).toBe('Unknown');
      expect(result.os).toBe('Unknown');
    });
  });

  describe('getClientIp', () => {
    it('should extract IP from X-Forwarded-For header', () => {
      const headers = { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' };
      const ip = getClientIp(headers, undefined);

      expect(ip).toBe('192.168.1.1');
    });

    it('should handle array X-Forwarded-For header', () => {
      const headers = { 'x-forwarded-for': ['192.168.1.1'] };
      const ip = getClientIp(headers, undefined);

      expect(ip).toBe('192.168.1.1');
    });

    it('should fall back to req.ip', () => {
      const headers = {};
      const ip = getClientIp(headers, '127.0.0.1');

      expect(ip).toBe('127.0.0.1');
    });

    it('should return undefined when no IP available', () => {
      const headers = {};
      const ip = getClientIp(headers, undefined);

      expect(ip).toBeUndefined();
    });
  });

  describe('setRefreshTokenCookie', () => {
    it('should set cookie with correct attributes', () => {
      const cookieFn = jest.fn();
      const res = {
        cookie: cookieFn,
      } as unknown as Response;

      setRefreshTokenCookie(res, 'test-token', 3600000);

      expect(cookieFn).toHaveBeenCalledWith(
        'refresh_token',
        'test-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/auth',
          maxAge: 3600000,
        }),
      );
    });
  });

  describe('clearRefreshTokenCookie', () => {
    it('should clear cookie with maxAge 0', () => {
      const cookieFn = jest.fn();
      const res = {
        cookie: cookieFn,
      } as unknown as Response;

      clearRefreshTokenCookie(res);

      expect(cookieFn).toHaveBeenCalledWith(
        'refresh_token',
        '',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/auth',
          maxAge: 0,
        }),
      );
    });
  });

  describe('getRefreshTokenFromCookie', () => {
    it('should extract refresh token from cookies', () => {
      const cookies = { refresh_token: 'test-token' };

      const result = getRefreshTokenFromCookie(cookies);

      expect(result).toBe('test-token');
    });

    it('should return null when cookie not present', () => {
      const cookies = {};

      const result = getRefreshTokenFromCookie(cookies);

      expect(result).toBeNull();
    });
  });
});
