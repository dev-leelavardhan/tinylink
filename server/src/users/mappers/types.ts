export interface UserProfileResponse {
  id: string;
  email: string;
  emailVerified: boolean;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}
