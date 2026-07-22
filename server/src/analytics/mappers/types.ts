export interface AnalyticsRow {
  id: string;
  timestamp: Date;
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
  referrer: string | null;
}

export type ClickResponse = AnalyticsRow;

export interface DailyAnalytics {
  date: Date;
  count: bigint;
}

interface BrowserGroup {
  browser: string | null;
  _count: number | bigint;
}

interface CountryGroup {
  country: string | null;
  _count: number | bigint;
}

interface DeviceGroup {
  device: string | null;
  _count: number | bigint;
}

interface BrowserCount {
  browser: string | null;
  count: number;
}

interface CountryCount {
  country: string | null;
  count: number;
}

interface DeviceCount {
  device: string | null;
  count: number;
}

interface DailyAnalyticsResponse {
  date: Date;
  count: number;
}

export interface AggregatedResponse {
  total: number;
  byBrowser: BrowserCount[];
  byCountry: CountryCount[];
  byDevice: DeviceCount[];
  byDay: DailyAnalyticsResponse[];
}

export interface AggregatedData {
  total: number | bigint;
  byBrowser: BrowserGroup[];
  byCountry: CountryGroup[];
  byDevice: DeviceGroup[];
  byDay: DailyAnalytics[];
}
