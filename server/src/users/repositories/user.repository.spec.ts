import { Test, TestingModule } from '@nestjs/testing';

import { UserRepository } from './user.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('UserRepository', () => {
  let repository: UserRepository;
  let prisma: {
    user: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    verificationOtp: {
      create: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      verificationOtp: {
        create: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserRepository, { provide: PrismaService, useValue: prisma }],
    }).compile();

    repository = module.get(UserRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create a user', async () => {
      const userData = { email: 'test@example.com', passwordHash: 'hashed' };
      const expectedUser = { id: 'user-1', ...userData };
      prisma.user.create.mockResolvedValue(expectedUser);

      const result = await repository.create(userData);

      expect(result).toEqual(expectedUser);
      expect(prisma.user.create).toHaveBeenCalledWith({ data: userData });
    });
  });

  describe('findByEmail', () => {
    it('should find a user by email', async () => {
      const expectedUser = { id: 'user-1', email: 'test@example.com' };
      prisma.user.findUnique.mockResolvedValue(expectedUser);

      const result = await repository.findByEmail('test@example.com');

      expect(result).toEqual(expectedUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find a user by id', async () => {
      const expectedUser = { id: 'user-1', email: 'test@example.com' };
      prisma.user.findUnique.mockResolvedValue(expectedUser);

      const result = await repository.findById('user-1');

      expect(result).toEqual(expectedUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const updatedUser = {
        id: 'user-1',
        lastLoginAt: new Date(),
      };
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await repository.updateLastLogin('user-1');

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: { lastLoginAt: expect.any(Date) },
      });
    });
  });

  describe('updateLastLoginMetadata', () => {
    it('should update last login metadata with IP and user agent', async () => {
      const updatedUser = {
        id: 'user-1',
        lastLoginAt: new Date(),
        lastLoginIp: '127.0.0.1',
        lastUserAgent: 'Mozilla/5.0',
      };
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await repository.updateLastLoginMetadata(
        'user-1',
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },

        data: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          lastLoginAt: expect.any(Date),
          lastLoginIp: '127.0.0.1',
          lastUserAgent: 'Mozilla/5.0',
        },
      });
    });
  });

  describe('incrementTokenVersion', () => {
    it('should increment token version', async () => {
      const updatedUser = { id: 'user-1', tokenVersion: 1 };
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await repository.incrementTokenVersion('user-1');

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tokenVersion: { increment: 1 } },
      });
    });
  });

  describe('updateStatus', () => {
    it('should update user status', async () => {
      const updatedUser = { id: 'user-1', status: 'ACTIVE' };
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await repository.updateStatus('user-1', 'ACTIVE');

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'ACTIVE' },
      });
    });
  });

  describe('incrementFailedLoginAttempts', () => {
    it('should increment failed login attempts', async () => {
      const updatedUser = { id: 'user-1', failedLoginAttempts: 1 };
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await repository.incrementFailedLoginAttempts('user-1');

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { failedLoginAttempts: { increment: 1 } },
      });
    });
  });

  describe('lockAccount', () => {
    it('should lock account with lockUntil timestamp', async () => {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      const updatedUser = { id: 'user-1', status: 'LOCKED', lockUntil };
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await repository.lockAccount('user-1', lockUntil);

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'LOCKED', lockUntil },
      });
    });
  });

  describe('resetFailedLoginAttempts', () => {
    it('should reset failed login attempts and unlock account', async () => {
      const updatedUser = {
        id: 'user-1',
        failedLoginAttempts: 0,
        lockUntil: null,
        status: 'ACTIVE',
      };
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await repository.resetFailedLoginAttempts('user-1');

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          failedLoginAttempts: 0,
          lockUntil: null,
          status: 'ACTIVE',
        },
      });
    });
  });

  describe('markEmailVerified', () => {
    it('should mark email as verified', async () => {
      const updatedUser = { id: 'user-1', emailVerified: true };
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await repository.markEmailVerified('user-1');

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailVerified: true },
      });
    });
  });

  describe('findMany', () => {
    it('should find users with email filter', async () => {
      const users = [{ id: 'user-1' }];
      prisma.user.findMany.mockResolvedValue(users);

      const result = await repository.findMany({ email: 'test@example.com' });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(users);
    });

    it('should find users with status filter', async () => {
      const users = [{ id: 'user-1' }];
      prisma.user.findMany.mockResolvedValue(users);

      const result = await repository.findMany({ status: 'ACTIVE' });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
      });
      expect(result).toEqual(users);
    });

    it('should find users with no filter', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const result = await repository.findMany({});

      expect(prisma.user.findMany).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual([]);
    });
  });

  describe('updatePassword', () => {
    it('should update user password', async () => {
      prisma.user.update.mockResolvedValue({ id: 'user-1' });

      await repository.updatePassword('user-1', 'new-hash');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'new-hash' },
      });
    });
  });

  describe('OTP methods', () => {
    describe('createOtp', () => {
      it('should create an OTP record with type EMAIL_VERIFICATION', async () => {
        const otpData = {
          userId: 'user-1',
          email: 'test@example.com',
          otpHash: 'hashed-otp',
          salt: 'test-salt',
          expiresAt: new Date(),
        };
        prisma.verificationOtp.create.mockResolvedValue({
          id: 'otp-1',
          ...otpData,
          type: 'EMAIL_VERIFICATION',
        });

        const result = await repository.createOtp(otpData);

        expect(result).toBeDefined();
        expect(prisma.verificationOtp.create).toHaveBeenCalledWith({
          data: {
            ...otpData,
            type: 'EMAIL_VERIFICATION',
          },
        });
      });

      it('should create an OTP record with type PASSWORD_RESET', async () => {
        const otpData = {
          userId: 'user-1',
          email: 'test@example.com',
          otpHash: 'hashed-otp',
          salt: 'test-salt',
          expiresAt: new Date(),
          type: 'PASSWORD_RESET' as const,
        };
        prisma.verificationOtp.create.mockResolvedValue({
          id: 'otp-1',
          ...otpData,
        });

        await repository.createOtp(otpData);

        expect(prisma.verificationOtp.create).toHaveBeenCalledWith({
          data: {
            userId: 'user-1',
            email: 'test@example.com',
            otpHash: 'hashed-otp',
            salt: 'test-salt',
            expiresAt: otpData.expiresAt,
            type: 'PASSWORD_RESET',
          },
        });
      });
    });

    describe('findValidOtp', () => {
      it('should find a valid OTP', async () => {
        const expectedOtp = {
          id: 'otp-1',
          userId: 'user-1',
          otpHash: 'hashed-otp',
          email: 'test@example.com',
          type: 'EMAIL_VERIFICATION',
          usedAt: null,
        };
        prisma.verificationOtp.findFirst.mockResolvedValue(expectedOtp);

        const result = await repository.findValidOtp('user-1');

        expect(result).toEqual(expectedOtp);
      });

      it('should return null if no valid OTP', async () => {
        prisma.verificationOtp.findFirst.mockResolvedValue(null);

        const result = await repository.findValidOtp('user-1');

        expect(result).toBeNull();
      });
    });

    describe('markOtpUsed', () => {
      it('should mark OTPs as used with usedAt timestamp', async () => {
        prisma.verificationOtp.updateMany.mockResolvedValue({ count: 1 });

        await repository.markOtpUsed('user-1');

        expect(prisma.verificationOtp.updateMany).toHaveBeenCalledWith({
          where: {
            userId: 'user-1',
            type: 'EMAIL_VERIFICATION',
            usedAt: null,
          },
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: { usedAt: expect.any(Date) },
        });
      });
    });
  });
});
