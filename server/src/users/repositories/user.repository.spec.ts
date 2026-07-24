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
  };

  beforeEach(async () => {
    prisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
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
});
