import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AliasValidatorService } from './alias-validator.service';
import { UrlRepository } from '../repositories/url.repository';

describe('AliasValidatorService (unit)', () => {
  let service: AliasValidatorService;
  let repository: { findByAlias: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    repository = { findByAlias: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AliasValidatorService,
        { provide: UrlRepository, useValue: repository },
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
    repository.findByAlias.mockResolvedValue({ id: 'existing' });

    await expect(service.validate('taken-alias')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('accepts valid unused aliases', async () => {
    repository.findByAlias.mockResolvedValue(null);

    await expect(service.validate('valid-alias')).resolves.toBe('valid-alias');
  });
});
