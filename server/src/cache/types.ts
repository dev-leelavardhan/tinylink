export interface CachedUrl {
  id: string;
  originalUrl: string;
  shortCode: string;
  customAlias: string | null;
  disabled: boolean;
  expiresAt: string | null; // ISO 8601 string
  lastAccessedAt: string | null;
  deletedAt: string | null; // ISO 8601 string
}

export type CacheResult =
  | { status: 'hit'; data: CachedUrl }
  | { status: 'negative' }
  | { status: 'miss' };
