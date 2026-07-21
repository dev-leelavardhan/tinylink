import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ShortCodeGeneratorService } from '../../common/short-code/short-code-generator.service';
import { UrlCacheService } from '../service/urls-cache.service';
import { AliasValidatorService } from '../validators/alias-validator.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import {
  URL_CREATE_LOG_MESSAGES,
  URL_CONSTANTS,
  URL_CREATE_ERROR_MESSAGES,
} from '../constants/url.constants';
import { CreateUrlDto } from '../dto/create-url.dto';
import { UrlRepository } from '../repositories/url.repository';
import { CreateUrlResponseDto } from '../urls.interface';
import { UrlMapper } from '../mappers/urls.mapper';
import { isUniqueConstraintOn } from '../utils/helpers';

@Injectable()
export class UrlCreateService {
  constructor(
    private readonly shortCodeGenerator: ShortCodeGeneratorService,
    private readonly aliasValidator: AliasValidatorService,
    private readonly cache: UrlCacheService,
    private readonly urlRepository: UrlRepository,
    private readonly urlMapper: UrlMapper,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UrlCreateService.name);
  }

  async create(dto: CreateUrlDto): Promise<CreateUrlResponseDto> {
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
        const url = await this.urlRepository.create({
          originalUrl: dto.originalUrl,
          shortCode,
          customAlias: alias,
          expiresAt: dto.expiresAt,
          strategy,
        });

        const cachedUrl = this.urlMapper.toCached(url);
        await this.cache.set(shortCode, cachedUrl);

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

          this.logger.warn(
            {
              shortCode,
              strategy,
              attempt,
            },
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
}
