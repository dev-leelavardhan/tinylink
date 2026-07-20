import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MIN_ALIAS_LENGTH,
  MAX_ALIAS_LENGTH,
  ALIAS_REGEX,
  RESERVED_ALIASES,
} from '../constants/alias.costants';

@Injectable()
export class AliasValidatorService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(alias: string): Promise<void> {
    const normalized = alias.toLowerCase();

    if (normalized.length < MIN_ALIAS_LENGTH) {
      throw new BadRequestException('Alias is too short');
    }

    if (normalized.length > MAX_ALIAS_LENGTH) {
      throw new BadRequestException('Alias is too long');
    }

    if (!ALIAS_REGEX.test(normalized)) {
      throw new BadRequestException('Invalid alias');
    }

    if (RESERVED_ALIASES.has(normalized)) {
      throw new BadRequestException('Reserved alias');
    }

    const exists = await this.prisma.url.findFirst({
      where: {
        OR: [
          {
            customAlias: normalized,
          },
          {
            shortCode: normalized,
          },
        ],
      },
    });

    if (exists) {
      throw new ConflictException('Alias already exists');
    }
  }
}
