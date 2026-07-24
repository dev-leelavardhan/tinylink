import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { UsersService } from '../service/users.service';

describe('AuthController', () => {
  let controller: AuthController;
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
      controllers: [AuthController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      const expected = { accessToken: 'token', refreshToken: 'refresh' };
      usersService.register.mockResolvedValue(expected);

      const result = await controller.register(dto);

      expect(result).toEqual(expected);
      expect(usersService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should login user', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      const expected = { accessToken: 'token', refreshToken: 'refresh' };
      usersService.login.mockResolvedValue(expected);

      const result = await controller.login(dto);

      expect(result).toEqual(expected);
      expect(usersService.login).toHaveBeenCalledWith(dto);
    });
  });

  describe('refresh', () => {
    it('should refresh token', async () => {
      const dto = { refreshToken: 'refresh-token' };
      const expected = { accessToken: 'new-token' };
      usersService.refresh.mockResolvedValue(expected);

      const result = await controller.refresh(dto);

      expect(result).toEqual(expected);
      expect(usersService.refresh).toHaveBeenCalledWith('refresh-token');
    });
  });
});
