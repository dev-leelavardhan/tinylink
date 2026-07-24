import {
  QR_CONSTANTS,
  QR_LOG_MESSAGES,
  QR_ERROR_MESSAGES,
} from './qr.constants';

describe('QR Constants', () => {
  describe('QR_CONSTANTS', () => {
    it('has default format as png', () => {
      expect(QR_CONSTANTS.DEFAULT_FORMAT).toBe('png');
    });

    it('has default size of 300', () => {
      expect(QR_CONSTANTS.DEFAULT_SIZE).toBe(300);
    });

    it('has min size of 100', () => {
      expect(QR_CONSTANTS.MIN_SIZE).toBe(100);
    });

    it('has max size of 1000', () => {
      expect(QR_CONSTANTS.MAX_SIZE).toBe(1000);
    });

    it('has cache max age of 1 year in seconds', () => {
      expect(QR_CONSTANTS.CACHE_MAX_AGE_SECONDS).toBe(365 * 24 * 60 * 60);
    });
  });

  describe('QR_LOG_MESSAGES', () => {
    it('has QR_GENERATED message', () => {
      expect(QR_LOG_MESSAGES.QR_GENERATED).toBe('QR code generated');
    });

    it('has URL_NOT_FOUND message', () => {
      expect(QR_LOG_MESSAGES.URL_NOT_FOUND).toBe(
        'URL not found for QR generation',
      );
    });
  });

  describe('QR_ERROR_MESSAGES', () => {
    it('has URL_NOT_FOUND message', () => {
      expect(QR_ERROR_MESSAGES.URL_NOT_FOUND).toBe('URL not found');
    });

    it('has GENERATION_FAILED message', () => {
      expect(QR_ERROR_MESSAGES.GENERATION_FAILED).toBe(
        'Failed to generate QR code',
      );
    });
  });
});
