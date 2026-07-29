import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { IdentifierStrategy, Url } from '@prisma/client';

import { RedisService } from '../../redis/service/redis.service';
import {
  USER_CONSTANTS,
  USER_ERROR_MESSAGES,
} from '../../users/constants/user.constants';
import { ShortCodeGeneratorService } from '../../common/short-code/short-code-generator.service';
import {
  URL_CONSTANTS,
  URL_CREATE_ERROR_MESSAGES,
  URL_CREATE_LOG_MESSAGES,
} from '../constants/url.constants';
import { CreateUrlDto } from '../dto/create-url.dto';
import { UrlMapper } from '../mappers/urls.mapper';
import { UrlRepository } from '../repositories/url.repository';
import { IdentifierRepository } from '../repositories/identifier.repository';
import { UrlCacheService } from '../service/urls-cache.service';
import { type CreateUrlResponseDto } from '../types';
import { normalizeUrl } from '../utils/helpers';

const STRATEGY_MAP: Record<string, string> = {
  random: 'RANDOM',
  hash: 'HASH',
  hashids: 'SEQUENTIAL',
  'auto-increment': 'SEQUENTIAL',
  snowflake: 'SNOWFLAKE',
  manual: 'MANUAL',
};
import { AliasValidatorService } from '../validators/alias-validator.service';

@Injectable()
export class UrlCreateService {
  constructor(
    private readonly shortCodeGenerator: ShortCodeGeneratorService,
    private readonly aliasValidator: AliasValidatorService,
    private readonly cache: UrlCacheService,
    private readonly urlRepository: UrlRepository,
    private readonly identifierRepository: IdentifierRepository,
    private readonly urlMapper: UrlMapper,
    private readonly redis: RedisService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UrlCreateService.name);
  }

  async create(
    dto: CreateUrlDto,
    userId?: string,
    ip?: string,
  ): Promise<CreateUrlResponseDto> {
    // 1. Anonymous rate limit
    if (!userId && ip) {
      await this.checkAndIncrementAnonymousRateLimit(ip);
    }

    const strategy = this.shortCodeGenerator.getStrategy();

    // 2. Validate custom alias (if provided)
    const alias = dto.customAlias
      ? await this.aliasValidator.validate(dto.customAlias)
      : undefined;

    // 3. Normalize URL and find or create the canonical Url record
    const normalized = normalizeUrl(dto.originalUrl);
    let url = await this.urlRepository.findByNormalizedUrl(normalized);

    if (!url) {
      try {
        url = await this.urlRepository.create({
          originalUrl: dto.originalUrl,
          normalizedUrl: normalized,
        });
      } catch (error: unknown) {
        if (
          error instanceof PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          // Race condition: another request created it first
          url = await this.urlRepository.findByNormalizedUrl(normalized);
          if (!url) {
            throw new InternalServerErrorException(
              URL_CREATE_ERROR_MESSAGES.CREATE_FAILED,
            );
          }
        } else {
          throw error;
        }
      }
    }

    // 4. If custom alias, create the identifier directly
    if (alias) {
      return this.createIdentifier(
        url,
        alias,
        'CUSTOM_ALIAS',
        strategy,
        userId,
        dto.expiresAt,
      );
    }

    // 5. For generated codes, check if user already has one for this URL
    if (userId) {
      const existing = await this.identifierRepository.findByUrlAndOwner(
        url.id,
        userId,
      );
      if (existing) {
        return this.urlMapper.toResponse(url, existing);
      }
    } else {
      // Guest: check for existing guest identifier
      const existing =
        await this.identifierRepository.findByUrlAndGuestGenerated(url.id);
      if (existing) {
        return this.urlMapper.toResponse(url, existing);
      }
    }

    // 6. Generate a new short code
    return this.generateAndCreateIdentifier(
      url,
      strategy,
      userId,
      dto.expiresAt,
    );
  }

  private async createIdentifier(
    url: Url,
    code: string,
    kind: 'GENERATED' | 'CUSTOM_ALIAS',
    strategy: string | undefined,
    userId?: string,
    expiresAt?: Date,
  ): Promise<CreateUrlResponseDto> {
    const mappedStrategy = strategy
      ? (STRATEGY_MAP[strategy] as IdentifierStrategy)
      : undefined;

    try {
      const identifier = await this.identifierRepository.create({
        code,
        kind,
        strategy: mappedStrategy,
        url: { connect: { id: url.id } },
        ...(userId ? { owner: { connect: { id: userId } } } : {}),
        ...(expiresAt ? { expiresAt } : {}),
      });

      const cached = this.urlMapper.toCached(url, identifier);
      await this.cache.set(code, cached);

      this.logger.info(
        { id: identifier.id, code, kind, strategy },
        URL_CREATE_LOG_MESSAGES.CREATE_SUCCESS,
      );

      return this.urlMapper.toResponse(url, identifier);
    } catch (error: unknown) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        if (kind === 'CUSTOM_ALIAS') {
          throw new ConflictException('Alias already exists');
        }
      }
      throw error;
    }
  }

  private async generateAndCreateIdentifier(
    url: Url,
    strategy: string | undefined,
    userId?: string,
    expiresAt?: Date,
  ): Promise<CreateUrlResponseDto> {
    const maxAttempts = URL_CONSTANTS.MAX_SHORT_CODE_ATTEMPTS;
    const mappedStrategy = strategy
      ? (STRATEGY_MAP[strategy] as IdentifierStrategy)
      : undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const code = await this.shortCodeGenerator.generate({
        originalUrl: url.originalUrl,
        attempt,
      });

      try {
        const identifier = await this.identifierRepository.create({
          code,
          kind: 'GENERATED',
          strategy: mappedStrategy,
          url: { connect: { id: url.id } },
          ...(userId ? { owner: { connect: { id: userId } } } : {}),
          ...(expiresAt ? { expiresAt } : {}),
        });

        const cached = this.urlMapper.toCached(url, identifier);
        await this.cache.set(code, cached);

        this.logger.info(
          { id: identifier.id, code, strategy, attempt },
          URL_CREATE_LOG_MESSAGES.CREATE_SUCCESS,
        );

        return this.urlMapper.toResponse(url, identifier);
      } catch (error: unknown) {
        if (
          error instanceof PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          // Code collision — retry with a new code
          this.logger.warn(
            { code, attempt },
            URL_CREATE_LOG_MESSAGES.COLLISION,
          );
          continue;
        }

        this.logger.error(
          { err: error, originalUrl: url.originalUrl, strategy },
          URL_CREATE_ERROR_MESSAGES.CREATE_FAILED,
        );

        throw new InternalServerErrorException(
          URL_CREATE_ERROR_MESSAGES.CREATE_FAILED,
        );
      }
    }

    this.logger.error(
      { attempts: maxAttempts, strategy },
      URL_CREATE_ERROR_MESSAGES.UNIQUE_CODE_GENERATION_FAILED,
    );

    throw new InternalServerErrorException(
      URL_CREATE_ERROR_MESSAGES.UNIQUE_CODE_GENERATION_FAILED,
    );
  }

  private async checkAndIncrementAnonymousRateLimit(ip: string): Promise<void> {
    const key = `${USER_CONSTANTS.RATE_LIMIT_KEY_PREFIX}${ip}`;
    const count = await this.redis.incr(key);

    // Only set TTL on first request in the window
    if (count === 1) {
      await this.redis.expire(key, USER_CONSTANTS.RATE_LIMIT_TTL_SECONDS);
    }

    if (count > USER_CONSTANTS.ANONYMOUS_URL_LIMIT) {
      throw new ForbiddenException(USER_ERROR_MESSAGES.FREE_LIMIT_REACHED);
    }
  }
}
