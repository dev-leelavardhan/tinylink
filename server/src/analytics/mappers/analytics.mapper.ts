import { Injectable } from '@nestjs/common';

export interface AnalyticsRow {
  id: string;
  timestamp: Date;
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
  referrer: string | null;
}

export interface ClickResponse {
  id: string;
  timestamp: Date;
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
  referrer: string | null;
}

export interface AggregatedResponse {
  total: number;
  byBrowser: Array<{ browser: string | null; count: number }>;
  byCountry: Array<{ country: string | null; count: number }>;
  byDevice: Array<{ device: string | null; count: number }>;
  byDay: unknown;
}

@Injectable()
export class AnalyticsMapper {
  toClickResponse(row: AnalyticsRow): ClickResponse {
    return {
      id: row.id,
      timestamp: row.timestamp,
      browser: row.browser,
      os: row.os,
      device: row.device,
      country: row.country,
      referrer: row.referrer,
    };
  }

  toAggregatedResponse(data: {
    total: number | bigint;
    byBrowser: Array<{
      browser: string | null;
      _count: number | bigint;
    }>;
    byCountry: Array<{
      country: string | null;
      _count: number | bigint;
    }>;
    byDevice: Array<{
      device: string | null;
      _count: number | bigint;
    }>;
    byDay: unknown;
  }): AggregatedResponse {
    return {
      total: Number(data.total),
      byBrowser: data.byBrowser.map((b) => ({
        browser: b.browser,
        count: Number(b._count),
      })),
      byCountry: data.byCountry.map((c) => ({
        country: c.country,
        count: Number(c._count),
      })),
      byDevice: data.byDevice.map((d) => ({
        device: d.device,
        count: Number(d._count),
      })),
      byDay: Array.isArray(data.byDay)
        ? data.byDay.map((row: Record<string, unknown>) => ({
            date: row.date,
            count: Number(row.count),
          }))
        : data.byDay,
    };
  }
}
