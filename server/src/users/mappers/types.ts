export interface UserProfileResponse {
  id: string;
  email: string;
  emailVerified: boolean;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface SessionResponse {
  id: string;
  deviceName: string | null;
  browser: string | null;
  operatingSystem: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}
