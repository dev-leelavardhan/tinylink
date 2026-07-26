import { Test, TestingModule } from '@nestjs/testing';
import { SessionRepository } from './session.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('SessionRepository', () => {
  let repository: SessionRepository;

  const prisma = {
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
});
