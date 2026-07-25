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
