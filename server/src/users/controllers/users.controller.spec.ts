import { Test, TestingModule } from '@nestjs/testing';

import { UsersController } from './users.controller';
import { UsersService } from '../service/users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    getProfile: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      getProfile: jest.fn(),
    };

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
      const req = { user: { userId: 'user-1' } };
      const expected = {
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
        status: 'ACTIVE',
        createdAt: new Date(),
        lastLoginAt: null,
      };
      usersService.getProfile.mockResolvedValue(expected);

      const result = await controller.getProfile(req);

      expect(result).toEqual(expected);
      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
    });
  });
});
