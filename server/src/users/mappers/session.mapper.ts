import { Injectable } from '@nestjs/common';
import { type Session } from '@prisma/client';

import { type SessionResponse } from './types';

@Injectable()
export class SessionMapper {
  toSessionResponse(session: Session): SessionResponse {
    return {
      id: session.id,
      deviceName: session.deviceName,
      browser: session.browser,
      operatingSystem: session.operatingSystem,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
    };
  }
}
