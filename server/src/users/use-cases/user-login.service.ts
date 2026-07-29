import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { PinoLogger } from 'nestjs-pino';

import {
  USER_CONSTANTS,
  USER_ERROR_MESSAGES,
  USER_LOG_MESSAGES,
} from '../constants/user.constants';
import { type LoginUserDto } from '../dto/login-user.dto';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import type { SessionRefreshContext } from '../repositories/session.repository';
import { type JwtPayload, type AuthTokens } from '../types';
import { BruteForceService } from './brute-force.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  normalizeEmail,
  hashRefreshToken,
  parseUserAgent,
  daysFromNow,
} from '../utils/auth.utils';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

@Injectable()
export class UserLoginService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly bruteForceService: BruteForceService,
    private readonly auditService: AuditService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserLoginService.name);
  }

  async login(
    dto: LoginUserDto,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<LoginResult> {
    this.logger.info('Starting login');

    const normalizedEmail = normalizeEmail(dto.email);

    const rateLimitOk =
      await this.bruteForceService.checkAccountRateLimit(normalizedEmail);
    if (!rateLimitOk) {
      throw new UnauthorizedException(USER_ERROR_MESSAGES.LOGIN_FAILED);
    }

    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user) {
      await this.auditService.log({
        event: 'LOGIN_FAILED',
        metadata: { email: normalizedEmail, reason: 'user_not_found' },
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedException(USER_ERROR_MESSAGES.LOGIN_FAILED);
    }

    const locked = await this.bruteForceService.isLocked(user.id);
    if (locked) {
      throw new ForbiddenException(USER_ERROR_MESSAGES.ACCOUNT_LOCKED);
    }

    if (user.status === 'PENDING_VERIFICATION') {
      throw new ForbiddenException(
        USER_ERROR_MESSAGES.ACCOUNT_PENDING_VERIFICATION,
      );
    }

    if (user.status === 'DISABLED') {
      throw new ForbiddenException(USER_ERROR_MESSAGES.ACCOUNT_DISABLED);
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException(USER_ERROR_MESSAGES.ACCOUNT_SUSPENDED);
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(USER_ERROR_MESSAGES.ACCOUNT_NOT_ACTIVE);
    }

    if (!user.emailVerified) {
      throw new ForbiddenException(
        USER_ERROR_MESSAGES.ACCOUNT_PENDING_VERIFICATION,
      );
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      await this.bruteForceService.checkAndRecordFailedAttempt(user.id);

      await this.auditService.log({
        userId: user.id,
        event: 'LOGIN_FAILED',
        metadata: { reason: 'invalid_password' },
        ipAddress: ip,
        userAgent,
      });

      throw new UnauthorizedException(USER_ERROR_MESSAGES.LOGIN_FAILED);
    }

    await this.bruteForceService.resetFailedAttempts(user.id);

    const updatedUser = await this.userRepository.incrementTokenVersion(
      user.id,
    );

    await this.userRepository.updateLastLoginMetadata(user.id, ip, userAgent);

    const { browser, os } = userAgent
      ? parseUserAgent(userAgent)
      : { browser: null, os: null };

    // Enforce max sessions per user — revoke oldest if at limit
    const activeSessions = await this.sessionRepository.findActiveByUserId(
      user.id,
    );
    if (activeSessions.length >= USER_CONSTANTS.MAX_SESSIONS_PER_USER) {
      const oldest = activeSessions[activeSessions.length - 1];
      await this.sessionRepository.revoke(oldest.id);
    }

    const expiresAt = daysFromNow(USER_CONSTANTS.SESSION_EXPIRY_DAYS);

    // Use a random placeholder hash — safe because it's unguessable
    // and will be replaced atomically after token generation.
    const placeholderHash = hashRefreshToken(randomUUID());

    const session = await this.sessionRepository.create({
      user: { connect: { id: user.id } },
      refreshTokenHash: placeholderHash,
      browser,
      operatingSystem: os,
      ipAddress: ip,
      userAgent,
      expiresAt,
    });

    const { accessToken, refreshToken } = await this.generateTokens(
      user.id,
      updatedUser.tokenVersion,
      session.id,
    );

    const refreshTokenHash = hashRefreshToken(refreshToken);
    await this.sessionRepository.updateRefreshTokenHash(
      session.id,
      refreshTokenHash,
    );

    await this.auditService.log({
      userId: user.id,
      event: 'LOGIN_SUCCESS',
      metadata: { sessionId: session.id },
      ipAddress: ip,
      userAgent,
    });

    await this.auditService.log({
      userId: user.id,
      event: 'SESSION_CREATED',
      metadata: { sessionId: session.id },
      ipAddress: ip,
      userAgent,
    });

    this.logger.info({ userId: user.id }, USER_LOG_MESSAGES.LOGIN_SUCCESS);

    return {
      accessToken,
      refreshToken,
      expiresIn: USER_CONSTANTS.LOGIN_ACCESS_TOKEN_EXPIRY_SECONDS,
      tokenType: USER_CONSTANTS.LOGIN_TOKEN_TYPE,
    };
  }

  async refresh(
    refreshToken: string,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<LoginResult> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      const refreshTokenHash = hashRefreshToken(refreshToken);

      const context: SessionRefreshContext =
        await this.sessionRepository.findSessionContextForRefresh(
          refreshTokenHash,
        );

      if (context.status !== 'active') {
        const user = await this.userRepository.findById(payload.sub);

        if (context.status === 'revoked') {
          if (user) {
            const reuseWindowMs =
              USER_CONSTANTS.REFRESH_TOKEN_REUSE_WINDOW_MINUTES * 60 * 1000;
            const since = new Date(Date.now() - reuseWindowMs);
            const recentlyRevoked =
              await this.sessionRepository.findRecentlyRevokedByUserId(
                user.id,
                since,
              );

            const reusedSession = recentlyRevoked.find(
              (s) => s.refreshTokenHash === refreshTokenHash,
            );

            if (reusedSession) {
              await this.sessionRepository.revokeAllForUser(user.id);

              await this.auditService.logRefreshTokenReuse(user.id, {
                reusedSessionId: reusedSession.id,
              });

              this.logger.warn(
                { userId: user.id, sessionId: reusedSession.id },
                'Refresh token reuse detected — all sessions revoked',
              );

              throw new UnauthorizedException(
                USER_ERROR_MESSAGES.REFRESH_TOKEN_REUSE_DETECTED,
              );
            }

            await this.auditService.logRefreshFailed(user.id, {
              reason: 'session_revoked',
              sessionId: context.session.id,
            });
          }

          throw new UnauthorizedException(USER_ERROR_MESSAGES.SESSION_REVOKED);
        }

        if (context.status === 'expired') {
          if (user) {
            await this.auditService.logSessionExpiredAttempt(user.id, {
              sessionId: context.session.id,
            });
          }

          throw new UnauthorizedException(USER_ERROR_MESSAGES.SESSION_EXPIRED);
        }

        throw new UnauthorizedException(
          USER_ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
        );
      }

      const session = context.session;

      // Verify sessionId binding: token must be bound to the session it was issued for
      if (payload.sessionId && payload.sessionId !== session.id) {
        throw new UnauthorizedException(
          USER_ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
        );
      }

      const user = await this.userRepository.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException(USER_ERROR_MESSAGES.USER_NOT_FOUND);
      }

      if (user.tokenVersion !== payload.tokenVersion) {
        throw new UnauthorizedException(USER_ERROR_MESSAGES.TOKEN_REVOKED);
      }

      const { browser, os } = userAgent
        ? parseUserAgent(userAgent)
        : { browser: null, os: null };

      const expiresAt = USER_CONSTANTS.SLIDING_SESSION_ENABLED
        ? daysFromNow(USER_CONSTANTS.SESSION_EXPIRY_DAYS)
        : session.expiresAt;

      // Generate a temporary refresh token hash for the new session.
      // The actual token is generated after the transaction succeeds.
      const tempRefreshTokenHash = hashRefreshToken(randomUUID());

      const { session: newSession, newTokenVersion } =
        await this.sessionRepository.rotateSession(
          session.id,
          {
            user: { connect: { id: user.id } },
            refreshTokenHash: tempRefreshTokenHash,
            browser,
            operatingSystem: os,
            ipAddress: ip,
            userAgent,
            lastUsedAt: new Date(),
            expiresAt,
          },
          user.id,
        );

      // Generate tokens with the atomically incremented tokenVersion
      const newTokens = await this.generateTokens(
        user.id,
        newTokenVersion,
        newSession.id,
      );

      // Update the session with the real refresh token hash
      const newRefreshTokenHash = hashRefreshToken(newTokens.refreshToken);
      await this.sessionRepository.updateRefreshTokenHash(
        newSession.id,
        newRefreshTokenHash,
      );

      await this.auditService.logRefreshTokenIssued(user.id, {
        oldSessionId: session.id,
        newSessionId: newSession.id,
      });

      this.logger.info(
        { userId: user.id },
        USER_LOG_MESSAGES.REFRESH_TOKEN_ISSUED,
      );

      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresIn: USER_CONSTANTS.LOGIN_ACCESS_TOKEN_EXPIRY_SECONDS,
        tokenType: USER_CONSTANTS.LOGIN_TOKEN_TYPE,
      };
    } catch (err: unknown) {
      if (
        err instanceof UnauthorizedException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      throw new UnauthorizedException(
        USER_ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
      );
    }
  }

  async logout(
    userId: string,
    sessionId: string,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException(
        USER_ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
      );
    }

    await this.sessionRepository.revoke(sessionId);

    await this.auditService.log({
      userId,
      event: 'SESSION_REVOKED',
      metadata: { sessionId },
      ipAddress: ip,
      userAgent,
    });

    this.logger.info({ userId, sessionId }, USER_LOG_MESSAGES.SESSION_REVOKED);
  }

  async getActiveSessions(userId: string) {
    return this.sessionRepository.findActiveByUserId(userId);
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException(
        USER_ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
      );
    }

    await this.sessionRepository.revoke(sessionId);

    await this.auditService.log({
      userId,
      event: 'SESSION_REVOKED',
      metadata: { sessionId },
      ipAddress: ip,
      userAgent,
    });

    this.logger.info({ userId, sessionId }, USER_LOG_MESSAGES.SESSION_REVOKED);
  }

  async globalLogout(
    userId: string,
    currentSessionId: string,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<void> {
    const result = await this.sessionRepository.revokeAllExcept(
      userId,
      currentSessionId,
    );

    await this.auditService.logGlobalLogout(
      userId,
      { revokedCount: result.count },
      ip,
      userAgent,
    );

    this.logger.info(
      { userId, revokedCount: result.count },
      USER_LOG_MESSAGES.GLOBAL_LOGOUT,
    );
  }

  async logoutAll(
    userId: string,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<void> {
    const result = await this.sessionRepository.revokeAllForUser(userId);

    await this.auditService.logGlobalLogout(
      userId,
      { revokedCount: result.count },
      ip,
      userAgent,
    );

    this.logger.info(
      { userId, revokedCount: result.count },
      USER_LOG_MESSAGES.LOGOUT_ALL_SUCCESS,
    );
  }

  private async generateTokens(
    userId: string,
    tokenVersion: number,
    sessionId?: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: userId,
      tokenVersion,
      iss: USER_CONSTANTS.JWT_ISSUER,
      aud: USER_CONSTANTS.JWT_AUDIENCE,
      jti: randomUUID(),
      ...(sessionId ? { sessionId } : {}),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, type: 'access' as const },
        {
          secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: USER_CONSTANTS.ACCESS_TOKEN_EXPIRY,
        },
      ),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' as const },
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: USER_CONSTANTS.REFRESH_TOKEN_EXPIRY,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }
}
