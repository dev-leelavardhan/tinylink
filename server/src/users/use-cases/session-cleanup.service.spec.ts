import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';

import { SessionCleanupService } from './session-cleanup.service';
import { SessionRepository } from '../repositories/session.repository';
import { createLoggerMock } from '../../testing/mocks';

describe('SessionCleanupService', () => {
  let service: SessionCleanupService;

  const sessionRepository = {
    deleteExpired: jest.fn(),
    deleteRevokedOlderThan: jest.fn(),
  };

  const logger = createLoggerMock();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionCleanupService,
        { provide: SessionRepository, useValue: sessionRepository },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(SessionCleanupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cleanup', () => {
    it('should delete expired and revoked sessions', async () => {
      sessionRepository.deleteExpired.mockResolvedValue({ count: 5 });
      sessionRepository.deleteRevokedOlderThan.mockResolvedValue({ count: 3 });

      await service.cleanup();

      expect(sessionRepository.deleteExpired).toHaveBeenCalled();
      expect(sessionRepository.deleteRevokedOlderThan).toHaveBeenCalledWith(
        expect.any(Date),
      );
      expect(logger.info).toHaveBeenLastCalledWith(
        expect.objectContaining({
          expiredDeleted: 5,
          revokedDeleted: 3,
        }),
        expect.stringContaining('completed'),
      );
    });

    it('should handle zero deletions', async () => {
      sessionRepository.deleteExpired.mockResolvedValue({ count: 0 });
      sessionRepository.deleteRevokedOlderThan.mockResolvedValue({ count: 0 });

      await service.cleanup();

      expect(logger.info).toHaveBeenLastCalledWith(
        expect.objectContaining({
          expiredDeleted: 0,
          revokedDeleted: 0,
        }),
        expect.any(String),
      );
    });
  });
});
