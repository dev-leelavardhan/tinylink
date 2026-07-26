import { SessionMapper } from './session.mapper';

describe('SessionMapper', () => {
  let mapper: SessionMapper;

  beforeEach(() => {
    mapper = new SessionMapper();
  });

  describe('toSessionResponse', () => {
    it('should map session to response', () => {
      const session = {
        id: 'session-1',
        userId: 'user-1',
        refreshTokenHash: 'hash',
        deviceName: 'Chrome on Windows',
        browser: 'Chrome',
        operatingSystem: 'Windows',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date('2026-01-01'),
        expiresAt: new Date('2026-01-08'),
        lastUsedAt: new Date('2026-01-02'),
        revokedAt: null,
      };

      const result = mapper.toSessionResponse(session);

      expect(result).toEqual({
        id: 'session-1',
        deviceName: 'Chrome on Windows',
        browser: 'Chrome',
        operatingSystem: 'Windows',
        ipAddress: '127.0.0.1',
        createdAt: new Date('2026-01-01'),
        lastUsedAt: new Date('2026-01-02'),
      });
    });

    it('should handle null fields', () => {
      const session = {
        id: 'session-1',
        userId: 'user-1',
        refreshTokenHash: 'hash',
        deviceName: null,
        browser: null,
        operatingSystem: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date('2026-01-01'),
        expiresAt: new Date('2026-01-08'),
        lastUsedAt: new Date('2026-01-02'),
        revokedAt: null,
      };

      const result = mapper.toSessionResponse(session);

      expect(result.deviceName).toBeNull();
      expect(result.browser).toBeNull();
      expect(result.operatingSystem).toBeNull();
      expect(result.ipAddress).toBeNull();
    });
  });
});
