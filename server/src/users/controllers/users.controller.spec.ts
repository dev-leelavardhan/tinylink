import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';

import { UsersController } from './users.controller';
import { UsersService } from '../service/users.service';

jest.mock('../utils/auth.utils', () => ({
  getClientIp: jest.fn(() => '127.0.0.1'),
}));

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  } as Request;
}

describe('UsersController', () => {
  let controller: UsersController;

  const usersService = {
    getProfile: jest.fn(),
    changePassword: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const profile = {
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
        status: 'ACTIVE',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };
      usersService.getProfile.mockResolvedValue(profile);

      const result = await controller.getProfile({ userId: 'user-1' });

      expect(result).toEqual(profile);
      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
    });
  });

  describe('changePassword', () => {
    it('should change password', async () => {
      usersService.changePassword.mockResolvedValue(undefined);

      const req = createMockRequest({
        headers: { 'user-agent': 'Mozilla/5.0' },
      });

      const result = await controller.changePassword(
        { userId: 'user-1' },
        req,
        {
          currentPassword: 'OldPass1!',
          newPassword: 'NewPass1!',
        },
      );

      expect(result).toEqual({
        message: 'Password changed successfully. Please sign in again.',
      });
      expect(usersService.changePassword).toHaveBeenCalledWith(
        'user-1',
        {
          currentPassword: 'OldPass1!',
          newPassword: 'NewPass1!',
        },
        '127.0.0.1',
        'Mozilla/5.0',
      );
    });
  });
});
