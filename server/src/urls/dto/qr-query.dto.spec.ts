import { qrQuerySchema } from './qr-query.dto';
import { QR_CONSTANTS } from '../constants/qr.constants';

describe('QR DTOs', () => {
  describe('qrQuerySchema', () => {
    it('applies default format and size values', () => {
      const result = qrQuerySchema.parse({});
      expect(result.format).toBe(QR_CONSTANTS.DEFAULT_FORMAT);
      expect(result.size).toBe(QR_CONSTANTS.DEFAULT_SIZE);
    });

    it('accepts valid format png', () => {
      const result = qrQuerySchema.parse({ format: 'png' });
      expect(result.format).toBe('png');
    });

    it('accepts valid format svg', () => {
      const result = qrQuerySchema.parse({ format: 'svg' });
      expect(result.format).toBe('svg');
    });

    it('rejects invalid format', () => {
      expect(() => qrQuerySchema.parse({ format: 'gif' })).toThrow();
    });

    it('accepts valid size within range', () => {
      const result = qrQuerySchema.parse({ size: 500 });
      expect(result.size).toBe(500);
    });

    it('coerces string size to number', () => {
      const result = qrQuerySchema.parse({ size: '250' });
      expect(result.size).toBe(250);
    });

    it('rejects size less than minimum', () => {
      expect(() => qrQuerySchema.parse({ size: 50 })).toThrow();
    });

    it('rejects size greater than maximum', () => {
      expect(() => qrQuerySchema.parse({ size: 1001 })).toThrow();
    });

    it('accepts minimum size value', () => {
      const result = qrQuerySchema.parse({ size: QR_CONSTANTS.MIN_SIZE });
      expect(result.size).toBe(QR_CONSTANTS.MIN_SIZE);
    });

    it('accepts maximum size value', () => {
      const result = qrQuerySchema.parse({ size: QR_CONSTANTS.MAX_SIZE });
      expect(result.size).toBe(QR_CONSTANTS.MAX_SIZE);
    });

    it('rejects non-integer size', () => {
      expect(() => qrQuerySchema.parse({ size: 1.5 })).toThrow();
    });

    it('accepts both format and size together', () => {
      const result = qrQuerySchema.parse({ format: 'svg', size: 400 });
      expect(result.format).toBe('svg');
      expect(result.size).toBe(400);
    });
  });
});
