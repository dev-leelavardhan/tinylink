import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';

import { UserProfileService } from './user-profile.service';
import { UserRepository } from '../repositories/user.repository';
import { UserMapper } from '../mappers/user.mapper';
import { createLoggerMock } from '../../testing/mocks';

describe('UserProfileService', () => {
  let service: UserProfileService;

  const repository = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updateLastLogin: jest.fn(),
    incrementTokenVersion: jest.fn(),
  };

  const mapper = {
    toProfile: jest.fn(),
  };

  const logger = createLoggerMock();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        { provide: UserRepository, useValue: repository },
        { provide: UserMapper, useValue: mapper },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(UserProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
        status: 'ACTIVE',
        createdAt: new Date(),
        lastLoginAt: null,
      };
      repository.findById.mockResolvedValue(user);

      const expectedProfile = {
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
        status: 'ACTIVE',
        createdAt: new Date(),
        lastLoginAt: null,
      };
      mapper.toProfile.mockReturnValue(expectedProfile);

      const result = await service.getProfile('user-1');

      expect(result).toEqual(expectedProfile);
      expect(repository.findById).toHaveBeenCalledWith('user-1');
      expect(mapper.toProfile).toHaveBeenCalledWith(user);
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
