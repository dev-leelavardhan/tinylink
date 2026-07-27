import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

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
import { UrlSlugRepository } from '../repositories/url-slug.repository';
import { UrlCacheService } from '../service/urls-cache.service';
import { type CreateUrlResponseDto } from '../types';
import { isUniqueConstraintOn } from '../utils/helpers';
import { AliasValidatorService } from '../validators/alias-validator.service';

@Injectable()
export class UrlCreateService {
  constructor(
    private readonly shortCodeGenerator: ShortCodeGeneratorService,
    private readonly aliasValidator: AliasValidatorService,
    private readonly cache: UrlCacheService,
    private readonly urlRepository: UrlRepository,
    private readonly urlSlugRepository: UrlSlugRepository,
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
    if (!userId && ip) {
      await this.checkAndIncrementAnonymousRateLimit(ip);
    }

    const strategy = this.shortCodeGenerator.getStrategy();

    const alias = dto.customAlias
      ? await this.aliasValidator.validate(dto.customAlias)
      : undefined;

    const existing = await this.urlRepository.findByOriginalUrlAndStrategy(
      dto.originalUrl,
      strategy,
    );

    if (existing) {
      return this.urlMapper.toResponse(existing);
    }

    const maxAttempts = URL_CONSTANTS.MAX_SHORT_CODE_ATTEMPTS;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const shortCode =
        alias ??
        (await this.shortCodeGenerator.generate({
          originalUrl: dto.originalUrl,
          attempt,
        }));

      try {
        const slugEntries = [{ slug: shortCode }];
        if (alias && alias !== shortCode) {
          slugEntries.push({ slug: alias });
        }

        // Create URL and slugs in a single transaction.
        // The UrlSlug.slug unique constraint enforces global namespace uniqueness.
        const url = await this.urlRepository.createWithSlugs(
          {
            originalUrl: dto.originalUrl,
            shortCode,
            customAlias: alias,
            expiresAt: dto.expiresAt,
            strategy,
            ...(userId ? { user: { connect: { id: userId } } } : {}),
          },
          slugEntries,
        );

        const cachedUrl = this.urlMapper.toCached(url);
        await this.cache.set(shortCode, cachedUrl);

        if (url.customAlias && url.customAlias !== shortCode) {
          await this.cache.set(url.customAlias, cachedUrl);
        }

        this.logger.info(
          {
            id: url.id,
            shortCode,
            strategy,
            attempt,
          },
          URL_CREATE_LOG_MESSAGES.CREATE_SUCCESS,
        );

        return this.urlMapper.toResponse(url);
      } catch (error: unknown) {
        if (
          error instanceof PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          if (isUniqueConstraintOn(error, ['originalUrl', 'strategy'])) {
            const concurrent =
              await this.urlRepository.findByOriginalUrlAndStrategy(
                dto.originalUrl,
                strategy,
              );

            if (concurrent) {
              return this.urlMapper.toResponse(concurrent);
            }
          }

          // Custom alias collisions cannot be retried — fail immediately
          if (alias) {
            throw new ConflictException('Alias already exists');
          }

          // Short code collided with the global slug namespace — retry with a new code
          this.logger.warn(
            { shortCode, attempt },
            URL_CREATE_LOG_MESSAGES.COLLISION,
          );
          continue;
        }

        this.logger.error(
          {
            err: error,
            originalUrl: dto.originalUrl,
            strategy,
          },
          URL_CREATE_ERROR_MESSAGES.CREATE_FAILED,
        );

        throw new InternalServerErrorException(
          URL_CREATE_ERROR_MESSAGES.CREATE_FAILED,
        );
      }
    }

    this.logger.error(
      {
        attempts: maxAttempts,
        strategy,
      },
      URL_CREATE_ERROR_MESSAGES.UNIQUE_CODE_GENERATION_FAILED,
    );

    throw new InternalServerErrorException(
      URL_CREATE_ERROR_MESSAGES.UNIQUE_CODE_GENERATION_FAILED,
    );
  }

  private async checkAndIncrementAnonymousRateLimit(ip: string): Promise<void> {
    const key = `${USER_CONSTANTS.RATE_LIMIT_KEY_PREFIX}${ip}`;
    const results = await this.redis
      .multi()
      .incr(key)
      .expire(key, USER_CONSTANTS.RATE_LIMIT_TTL_SECONDS)
      .exec();
    const count = results?.[0]?.[1] as number;
    if (count > USER_CONSTANTS.ANONYMOUS_URL_LIMIT) {
      throw new ForbiddenException(USER_ERROR_MESSAGES.FREE_LIMIT_REACHED);
    }
  }
}
