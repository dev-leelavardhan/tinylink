import { Injectable } from '@nestjs/common';
import {
  type AnalyticsRow,
  type ClickResponse,
  type AggregatedData,
  type AggregatedResponse,
} from './types';

@Injectable()
export class AnalyticsMapper {
  toClickResponse(row: AnalyticsRow): ClickResponse {
    return { ...row };
  }

  toAggregatedResponse(data: AggregatedData): AggregatedResponse {
    return {
      total: Number(data.total),

      byBrowser: data.byBrowser.map(({ browser, _count }) => ({
        browser,
        count: Number(_count),
      })),

      byCountry: data.byCountry.map(({ country, _count }) => ({
        country,
        count: Number(_count),
      })),

      byDevice: data.byDevice.map(({ device, _count }) => ({
        device,
        count: Number(_count),
      })),

      byDay: data.byDay.map(({ date, count }) => ({
        date,
        count: Number(count),
      })),
    };
  }
}
