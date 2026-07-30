import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AliasValidatorService } from './alias-validator.service';
import { IdentifierRepository } from '../repositories/identifier.repository';

describe('AliasValidatorService (unit)', () => {
  let service: AliasValidatorService;
  let identifierRepository: { existsByCode: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    identifierRepository = { existsByCode: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AliasValidatorService,
        { provide: IdentifierRepository, useValue: identifierRepository },
      ],
    }).compile();

    service = module.get(AliasValidatorService);
  });

  it('rejects aliases that are too short', async () => {
    await expect(service.validate('ab')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects aliases that are too long', async () => {
    await expect(service.validate('a'.repeat(31))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects aliases with invalid characters', async () => {
    await expect(service.validate('bad alias!')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects reserved aliases', async () => {
    await expect(service.validate('health')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects aliases that already exist', async () => {
    identifierRepository.existsByCode.mockResolvedValue(true);

    await expect(service.validate('taken-alias')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('accepts valid unused aliases', async () => {
    identifierRepository.existsByCode.mockResolvedValue(false);

    await expect(service.validate('valid-alias')).resolves.toBe('valid-alias');
  });
});
