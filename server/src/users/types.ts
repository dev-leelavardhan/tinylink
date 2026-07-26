export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  tokenVersion: number;
  sessionId?: string;
}
