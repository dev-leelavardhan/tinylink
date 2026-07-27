import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AliasValidatorService } from './alias-validator.service';
import { UrlSlugRepository } from '../repositories/url-slug.repository';

describe('AliasValidatorService (unit)', () => {
  let service: AliasValidatorService;
  let slugRepository: { existsBySlug: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    slugRepository = { existsBySlug: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AliasValidatorService,
        { provide: UrlSlugRepository, useValue: slugRepository },
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
    slugRepository.existsBySlug.mockResolvedValue(true);

    await expect(service.validate('taken-alias')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('accepts valid unused aliases', async () => {
    slugRepository.existsBySlug.mockResolvedValue(false);

    await expect(service.validate('valid-alias')).resolves.toBe('valid-alias');
  });
});
