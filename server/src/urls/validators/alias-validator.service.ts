import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  MIN_ALIAS_LENGTH,
  MAX_ALIAS_LENGTH,
  ALIAS_REGEX,
  RESERVED_ALIASES,
} from '../constants/alias.constants';
import { UrlSlugRepository } from '../repositories/url-slug.repository';

@Injectable()
export class AliasValidatorService {
  constructor(private readonly slugRepository: UrlSlugRepository) {}

  async validate(alias: string): Promise<string> {
    const normalized = alias.trim().toLowerCase();

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

    const exists = await this.slugRepository.existsBySlug(normalized);

    if (exists) {
      throw new ConflictException('Alias already exists');
    }

    return normalized;
  }
}
