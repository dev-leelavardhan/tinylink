export interface CreateUrlResponseDto {
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
}

export interface Url {
  id: string;
  originalUrl: string;
  shortCode: string;
  customAlias: string | null;
  disabled: boolean;
  expiresAt: Date | null;
}
