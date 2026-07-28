import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import * as argon2 from 'argon2';

import { UserChangePasswordService } from './user-change-password.service';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { AuditService } from '../../common/audit/audit.service';
import { createLoggerMock } from '../../testing/mocks';

jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));

describe('UserChangePasswordService', () => {
  let service: UserChangePasswordService;

  const userRepository = {
    findById: jest.fn(),
    updatePassword: jest.fn(),
    incrementTokenVersion: jest.fn(),
  };

  const sessionRepository = {
    revokeAllForUser: jest.fn(),
  };

  const auditService = {
    logPasswordChanged: jest.fn(),
  };

  const logger = createLoggerMock();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserChangePasswordService,
        { provide: UserRepository, useValue: userRepository },
        { provide: SessionRepository, useValue: sessionRepository },
        { provide: AuditService, useValue: auditService },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(UserChangePasswordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('changePassword', () => {
    const dto = {
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass1!',
    };

    it('should change password successfully', async () => {
      userRepository.findById.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'old-hash',
      });
      (argon2.verify as jest.Mock)
        .mockResolvedValueOnce(true) // current password valid
        .mockResolvedValueOnce(false); // new password different
      (argon2.hash as jest.Mock).mockResolvedValue('new-hash');
      userRepository.updatePassword.mockResolvedValue({});
      userRepository.incrementTokenVersion.mockResolvedValue({
        tokenVersion: 2,
      });
      sessionRepository.revokeAllForUser.mockResolvedValue({ count: 1 });

      await service.changePassword('user-1', dto, '127.0.0.1', 'Mozilla/5.0');

      expect(userRepository.updatePassword).toHaveBeenCalledWith(
        'user-1',
        'new-hash',
      );
      expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith('user-1');
      expect(auditService.logPasswordChanged).toHaveBeenCalled();
    });

    it('should throw if user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(
        service.changePassword('user-1', dto, '127.0.0.1', 'Mozilla/5.0'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if current password is invalid', async () => {
      userRepository.findById.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'old-hash',
      });
      (argon2.verify as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.changePassword('user-1', dto, '127.0.0.1', 'Mozilla/5.0'),
      ).rejects.toThrow(UnauthorizedException);

      expect(auditService.logPasswordChanged).toHaveBeenCalled();
    });

    it('should throw if new password is same as current', async () => {
      userRepository.findById.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'old-hash',
      });
      (argon2.verify as jest.Mock)
        .mockResolvedValueOnce(true) // current password valid
        .mockResolvedValueOnce(true); // same password

      await expect(
        service.changePassword('user-1', dto, '127.0.0.1', 'Mozilla/5.0'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
