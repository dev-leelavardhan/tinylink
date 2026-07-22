import { AnalyticsMapper } from './analytics.mapper';
import { AggregatedData, AnalyticsRow } from './types';

describe('AnalyticsMapper', () => {
  let mapper: AnalyticsMapper;

  beforeEach(() => {
    mapper = new AnalyticsMapper();
  });

  describe('toClickResponse', () => {
    it('returns the same row data', () => {
      const row: AnalyticsRow = {
        id: 'test-id',
        timestamp: new Date('2024-01-15'),
        browser: 'Chrome',
        os: 'Windows',
        device: 'Desktop',
        country: 'US',
        referrer: 'https://example.com',
      };

      const result = mapper.toClickResponse(row);

      expect(result).toEqual(row);
    });

    it('handles null fields', () => {
      const row: AnalyticsRow = {
        id: 'test-id',
        timestamp: new Date(),
        browser: null,
        os: null,
        device: null,
        country: null,
        referrer: null,
      };

      const result = mapper.toClickResponse(row);

      expect(result).toEqual(row);
    });
  });

  describe('toAggregatedResponse', () => {
    it('transforms aggregated data correctly', () => {
      const data: AggregatedData = {
        total: 100n,
        byBrowser: [
          { browser: 'Chrome', _count: 60n },
          { browser: 'Firefox', _count: 40n },
        ],
        byCountry: [
          { country: 'US', _count: 70n },
          { country: 'UK', _count: 30n },
        ],
        byDevice: [
          { device: 'Desktop', _count: 80n },
          { device: 'Mobile', _count: 20n },
        ],
        byDay: [
          { date: new Date('2024-01-01'), count: 50n },
          { date: new Date('2024-01-02'), count: 50n },
        ],
      };

      const result = mapper.toAggregatedResponse(data);

      expect(result.total).toBe(100);
      expect(result.byBrowser).toEqual([
        { browser: 'Chrome', count: 60 },
        { browser: 'Firefox', count: 40 },
      ]);
      expect(result.byCountry).toEqual([
        { country: 'US', count: 70 },
        { country: 'UK', count: 30 },
      ]);
      expect(result.byDevice).toEqual([
        { device: 'Desktop', count: 80 },
        { device: 'Mobile', count: 20 },
      ]);
      expect(result.byDay).toEqual([
        { date: new Date('2024-01-01'), count: 50 },
        { date: new Date('2024-01-02'), count: 50 },
      ]);
    });

    it('handles empty arrays', () => {
      const data: AggregatedData = {
        total: 0n,
        byBrowser: [],
        byCountry: [],
        byDevice: [],
        byDay: [],
      };

      const result = mapper.toAggregatedResponse(data);

      expect(result.total).toBe(0);
      expect(result.byBrowser).toEqual([]);
      expect(result.byCountry).toEqual([]);
      expect(result.byDevice).toEqual([]);
      expect(result.byDay).toEqual([]);
    });

    it('converts number counts correctly', () => {
      const data: AggregatedData = {
        total: 42,
        byBrowser: [{ browser: 'Safari', _count: 42 }],
        byCountry: [{ country: 'JP', _count: 42 }],
        byDevice: [{ device: 'Mobile', _count: 42 }],
        byDay: [{ date: new Date(), count: 42 }],
      };

      const result = mapper.toAggregatedResponse(data);

      expect(result.total).toBe(42);
      expect(result.byBrowser[0].count).toBe(42);
    });
  });
});
