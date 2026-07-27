import { Test, TestingModule } from '@nestjs/testing';
import { SessionRepository } from './session.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('SessionRepository', () => {
  let repository: SessionRepository;

  const prisma = {
    $transaction: jest.fn(),
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(SessionRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create a session', async () => {
      const data = {
        user: { connect: { id: 'user-1' } },
        refreshTokenHash: 'hash',
        expiresAt: new Date(),
      };
      const session = { id: 'session-1', ...data };
      prisma.session.create.mockResolvedValue(session);

      const result = await repository.create(data);

      expect(prisma.session.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(session);
    });
  });

  describe('findByRefreshTokenHash', () => {
    it('should find active session by refresh token hash', async () => {
      const session = { id: 'session-1', refreshTokenHash: 'hash' };
      prisma.session.findFirst.mockResolvedValue(session);

      const result = await repository.findByRefreshTokenHash('hash');

      expect(prisma.session.findFirst).toHaveBeenCalledWith({
        where: {
          refreshTokenHash: 'hash',
          revokedAt: null,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          expiresAt: { gt: expect.any(Date) },
        },
      });
      expect(result).toEqual(session);
    });

    it('should return null when session not found', async () => {
      prisma.session.findFirst.mockResolvedValue(null);

      const result = await repository.findByRefreshTokenHash('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findActiveByUserId', () => {
    it('should find active sessions for user', async () => {
      const sessions = [{ id: 'session-1' }, { id: 'session-2' }];
      prisma.session.findMany.mockResolvedValue(sessions);

      const result = await repository.findActiveByUserId('user-1');

      expect(prisma.session.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          revokedAt: null,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { lastUsedAt: 'desc' },
      });
      expect(result).toEqual(sessions);
    });
  });

  describe('revoke', () => {
    it('should revoke a session', async () => {
      const revokedAt = new Date();
      const session = { id: 'session-1', revokedAt };
      prisma.session.update.mockResolvedValue(session);

      const result = await repository.revoke('session-1');

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).toEqual(session);
    });
  });

  describe('revokeAllForUser', () => {
    it('should revoke all active sessions for user', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 3 });

      const result = await repository.revokeAllForUser('user-1');

      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          revokedAt: null,
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('countActiveForUser', () => {
    it('should count active sessions', async () => {
      prisma.session.count.mockResolvedValue(2);

      const result = await repository.countActiveForUser('user-1');

      expect(prisma.session.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          revokedAt: null,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          expiresAt: { gt: expect.any(Date) },
        },
      });
      expect(result).toBe(2);
    });
  });

  describe('findSessionContextForRefresh', () => {
    it('should return active session', async () => {
      const session = {
        id: 'session-1',
        refreshTokenHash: 'hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      };
      prisma.session.findFirst.mockResolvedValue(session);

      const result = await repository.findSessionContextForRefresh('hash');

      expect(result).toEqual({ status: 'active', session });
    });

    it('should return expired session', async () => {
      const session = {
        id: 'session-1',
        refreshTokenHash: 'hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 86400000),
      };
      prisma.session.findFirst.mockResolvedValue(session);

      const result = await repository.findSessionContextForRefresh('hash');

      expect(result).toEqual({ status: 'expired', session });
    });

    it('should return revoked session', async () => {
      const session = {
        id: 'session-1',
        refreshTokenHash: 'hash',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };
      prisma.session.findFirst.mockResolvedValue(session);

      const result = await repository.findSessionContextForRefresh('hash');

      expect(result).toEqual({ status: 'revoked', session });
    });

    it('should return not_found when no session exists', async () => {
      prisma.session.findFirst.mockResolvedValue(null);

      const result = await repository.findSessionContextForRefresh('hash');

      expect(result).toEqual({ status: 'not_found' });
    });
  });

  describe('rotateSession', () => {
    it('should revoke old session, increment tokenVersion, and create new session atomically', async () => {
      const newSession = { id: 'session-2', refreshTokenHash: 'new-hash' };

      const mockTx = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        user: { update: jest.fn().mockResolvedValue({ tokenVersion: 2 }) },
        session: { create: jest.fn().mockResolvedValue(newSession) },
      };

      prisma.$transaction = jest
        .fn()
        .mockImplementation((fn: (arg: unknown) => unknown) => fn(mockTx));

      const newSessionData = {
        user: { connect: { id: 'user-1' } },
        refreshTokenHash: 'new-hash',
        expiresAt: new Date(),
      };

      const result = await repository.rotateSession(
        'session-1',
        newSessionData,
        'user-1',
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockTx.$executeRaw).toHaveBeenCalled();
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tokenVersion: { increment: 1 } },
        select: { tokenVersion: true },
      });
      expect(mockTx.session.create).toHaveBeenCalledWith({
        data: newSessionData,
      });
      expect(result).toEqual({ session: newSession, newTokenVersion: 2 });
    });

    it('should throw when session already revoked (concurrent refresh)', async () => {
      const mockTx = {
        $executeRaw: jest.fn().mockResolvedValue(0),
        user: { update: jest.fn() },
        session: { create: jest.fn() },
      };

      prisma.$transaction = jest
        .fn()
        .mockImplementation((fn: (arg: unknown) => unknown) => fn(mockTx));

      const newSessionData = {
        user: { connect: { id: 'user-1' } },
        refreshTokenHash: 'new-hash',
        expiresAt: new Date(),
      };

      await expect(
        repository.rotateSession('session-1', newSessionData, 'user-1'),
      ).rejects.toThrow('Session already revoked');
    });
  });
});
