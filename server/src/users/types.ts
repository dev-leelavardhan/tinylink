export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  tokenVersion: number;
  iss: string;
  aud: string;
  jti: string;
  sessionId?: string;
}
