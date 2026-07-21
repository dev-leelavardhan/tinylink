import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { createPrismaMock } from '../../testing/mocks';
import { PrismaService } from '../../prisma/prisma.service';
import { AliasValidatorService } from '../validators/alias-validator.service';

describe('AliasValidatorService (unit)', () => {
  let service: AliasValidatorService;
  const prisma = createPrismaMock();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AliasValidatorService,
        { provide: PrismaService, useValue: prisma },
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
    prisma.url.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(service.validate('taken-alias')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('accepts valid unused aliases', async () => {
    prisma.url.findFirst.mockResolvedValue(null);

    await expect(service.validate('valid-alias')).resolves.toBeUndefined();
  });
});
