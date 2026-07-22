import {
  analyticsQuerySchema,
  paginationQuerySchema,
} from './analytics-query.dto';
import { ANALYTICS_CONSTANTS } from '../constants/analytics.constants';

describe('Analytics DTOs', () => {
  describe('analyticsQuerySchema', () => {
    it('applies default days value', () => {
      const result = analyticsQuerySchema.parse({});
      expect(result.days).toBe(ANALYTICS_CONSTANTS.DEFAULT_ANALYTICS_DAYS);
    });

    it('accepts valid days value', () => {
      const result = analyticsQuerySchema.parse({ days: 7 });
      expect(result.days).toBe(7);
    });

    it('coerces string days to number', () => {
      const result = analyticsQuerySchema.parse({ days: '14' });
      expect(result.days).toBe(14);
    });

    it('rejects days less than 1', () => {
      expect(() => analyticsQuerySchema.parse({ days: 0 })).toThrow();
    });

    it('rejects days greater than max', () => {
      expect(() =>
        analyticsQuerySchema.parse({
          days: ANALYTICS_CONSTANTS.MAX_ANALYTICS_DAYS + 1,
        }),
      ).toThrow();
    });

    it('accepts max days value', () => {
      const result = analyticsQuerySchema.parse({
        days: ANALYTICS_CONSTANTS.MAX_ANALYTICS_DAYS,
      });
      expect(result.days).toBe(ANALYTICS_CONSTANTS.MAX_ANALYTICS_DAYS);
    });

    it('rejects non-integer days', () => {
      expect(() => analyticsQuerySchema.parse({ days: 1.5 })).toThrow();
    });
  });

  describe('paginationQuerySchema', () => {
    it('applies default values', () => {
      const result = paginationQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(ANALYTICS_CONSTANTS.DEFAULT_PAGE_SIZE);
    });

    it('accepts valid pagination values', () => {
      const result = paginationQuerySchema.parse({ page: 2, limit: 25 });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(25);
    });

    it('coerces string values to numbers', () => {
      const result = paginationQuerySchema.parse({ page: '3', limit: '10' });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
    });

    it('rejects page less than 1', () => {
      expect(() => paginationQuerySchema.parse({ page: 0 })).toThrow();
    });

    it('rejects limit less than 1', () => {
      expect(() => paginationQuerySchema.parse({ limit: 0 })).toThrow();
    });

    it('rejects limit greater than max', () => {
      expect(() =>
        paginationQuerySchema.parse({
          limit: ANALYTICS_CONSTANTS.MAX_PAGE_SIZE + 1,
        }),
      ).toThrow();
    });

    it('accepts max limit value', () => {
      const result = paginationQuerySchema.parse({
        limit: ANALYTICS_CONSTANTS.MAX_PAGE_SIZE,
      });
      expect(result.limit).toBe(ANALYTICS_CONSTANTS.MAX_PAGE_SIZE);
    });
  });
});
