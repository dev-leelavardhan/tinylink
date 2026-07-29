export interface CachedIdentifier {
  id: string; // identifier id
  urlId: string; // url id
  originalUrl: string;
  code: string;
  kind: 'GENERATED' | 'CUSTOM_ALIAS';
  ownerId: string | null;
  strategy: string | null;
  expiresAt: string | null; // ISO 8601 string
  disabled: boolean;
  deletedAt: string | null; // ISO 8601 string
}

export type CacheResult =
  | { status: 'hit'; data: CachedIdentifier }
  | { status: 'negative' }
  | { status: 'miss' };
