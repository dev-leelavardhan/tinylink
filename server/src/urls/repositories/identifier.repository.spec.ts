/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';

import { IdentifierRepository } from './identifier.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('IdentifierRepository', () => {
  let repository: IdentifierRepository;
  let prisma: {
    identifier: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      identifier: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentifierRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(IdentifierRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findByIdentifierCode', () => {
    it('should find identifier by code', async () => {
      const mockIdentifier = { id: 'id-1', code: 'abc123' };
      prisma.identifier.findUnique.mockResolvedValue(mockIdentifier);

      const result = await repository.findByIdentifierCode('abc123');

      expect(result).toEqual(mockIdentifier);
      expect(prisma.identifier.findUnique).toHaveBeenCalledWith({
        where: { code: 'abc123' },
      });
    });

    it('should return null if not found', async () => {
      prisma.identifier.findUnique.mockResolvedValue(null);

      const result = await repository.findByIdentifierCode('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByUrlAndOwner', () => {
    it('should find identifier by urlId, ownerId and kind', async () => {
      const mockIdentifier = { id: 'id-1', urlId: 'url-1', ownerId: 'owner-1' };
      prisma.identifier.findFirst.mockResolvedValue(mockIdentifier);

      const result = await repository.findByUrlAndOwner(
        'url-1',
        'owner-1',
        'GENERATED',
      );

      expect(result).toEqual(mockIdentifier);
      expect(prisma.identifier.findFirst).toHaveBeenCalledWith({
        where: {
          urlId: 'url-1',
          ownerId: 'owner-1',
          kind: 'GENERATED',
          deletedAt: null,
          disabled: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
        },
      });
    });

    it('should use default kind GENERATED', async () => {
      prisma.identifier.findFirst.mockResolvedValue(null);

      await repository.findByUrlAndOwner('url-1', 'owner-1');

      expect(prisma.identifier.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ kind: 'GENERATED' }),
        }),
      );
    });

    it('should support CUSTOM_ALIAS kind', async () => {
      prisma.identifier.findFirst.mockResolvedValue(null);

      await repository.findByUrlAndOwner('url-1', 'owner-1', 'CUSTOM_ALIAS');

      expect(prisma.identifier.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ kind: 'CUSTOM_ALIAS' }),
        }),
      );
    });
  });

  describe('findAllByUrlAndOwner', () => {
    it('should return all identifier ids for url and owner', async () => {
      const mockIds = [{ id: 'id-1' }, { id: 'id-2' }];
      prisma.identifier.findMany.mockResolvedValue(mockIds);

      const result = await repository.findAllByUrlAndOwner('url-1', 'owner-1');

      expect(result).toEqual(mockIds);
      expect(prisma.identifier.findMany).toHaveBeenCalledWith({
        where: {
          urlId: 'url-1',
          ownerId: 'owner-1',
          deletedAt: null,
        },
        select: { id: true },
      });
    });
  });

  describe('findByUrlAndGuestGenerated', () => {
    it('should find guest-generated identifier', async () => {
      const mockIdentifier = { id: 'id-1', ownerId: null, kind: 'GENERATED' };
      prisma.identifier.findFirst.mockResolvedValue(mockIdentifier);

      const result = await repository.findByUrlAndGuestGenerated('url-1');

      expect(result).toEqual(mockIdentifier);
      expect(prisma.identifier.findFirst).toHaveBeenCalledWith({
        where: {
          urlId: 'url-1',
          ownerId: null,
          kind: 'GENERATED',
          deletedAt: null,
          disabled: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
        },
      });
    });
  });

  describe('existsByCode', () => {
    it('should return true if code exists', async () => {
      prisma.identifier.count.mockResolvedValue(1);

      const result = await repository.existsByCode('abc123');

      expect(result).toBe(true);
      expect(prisma.identifier.count).toHaveBeenCalledWith({
        where: { code: 'abc123' },
      });
    });

    it('should return false if code does not exist', async () => {
      prisma.identifier.count.mockResolvedValue(0);

      const result = await repository.existsByCode('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('create', () => {
    it('should create a new identifier', async () => {
      const mockData: Prisma.IdentifierCreateInput = {
        code: 'abc123',
        kind: 'GENERATED',
        url: { connect: { id: 'url-1' } },
      };
      const mockCreated = { id: 'id-1', code: 'abc123', urlId: 'url-1' };
      prisma.identifier.create.mockResolvedValue(mockCreated);

      const result = await repository.create(mockData);

      expect(result).toEqual(mockCreated);
      expect(prisma.identifier.create).toHaveBeenCalledWith({ data: mockData });
    });
  });

  describe('update', () => {
    it('should update an identifier', async () => {
      const mockData: Prisma.IdentifierUpdateInput = { disabled: true };
      const mockUpdated = { id: 'id-1', disabled: true };
      prisma.identifier.update.mockResolvedValue(mockUpdated);

      const result = await repository.update('id-1', mockData);

      expect(result).toEqual(mockUpdated);
      expect(prisma.identifier.update).toHaveBeenCalledWith({
        where: { id: 'id-1' },
        data: mockData,
      });
    });
  });

  describe('deleteByUrlId', () => {
    it('should delete all identifiers for a url', async () => {
      prisma.identifier.deleteMany.mockResolvedValue({ count: 3 });

      await repository.deleteByUrlId('url-1');

      expect(prisma.identifier.deleteMany).toHaveBeenCalledWith({
        where: { urlId: 'url-1' },
      });
    });
  });

  describe('findExpiredIdentifiers', () => {
    it('should find expired identifiers with default limit', async () => {
      const mockIdentifiers = [{ id: 'id-1' }, { id: 'id-2' }];
      prisma.identifier.findMany.mockResolvedValue(mockIdentifiers);

      const result = await repository.findExpiredIdentifiers();

      expect(result).toEqual(mockIdentifiers);
      expect(prisma.identifier.findMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
          deletedAt: null,
          disabled: false,
        },
        take: 100,
      });
    });

    it('should use custom limit', async () => {
      prisma.identifier.findMany.mockResolvedValue([]);

      await repository.findExpiredIdentifiers(50);

      expect(prisma.identifier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });
});
