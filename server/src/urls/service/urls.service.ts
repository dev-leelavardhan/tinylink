import { PinoLogger } from 'nestjs-pino';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import {
  GoneException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CreateUrlDto } from '../dto/create-url.dto';
import { CreateUrlResponseDto } from '../dto/create-utl-response-dto';
import {
  URL_CONSTANTS,
  URL_CREATE_ERROR_MESSAGES,
  URL_CREATE_LOG_MESSAGES,
  URL_REDIRECT_ERROR_MESSAGES,
  URL_REDIRECT_LOG_MESSAGES,
} from '../constants/url.constants';
import { ShortCodeGeneratorService } from '../../common/short-code/short-code-generator.service';
import { AliasValidatorService } from './alias-validator.service';

@Injectable()
export class UrlsService {
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly shortCodeGenerator: ShortCodeGeneratorService,
    private readonly aliasValidator: AliasValidatorService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UrlsService.name);
    this.baseUrl = this.config.getOrThrow<string>('BASE_URL');
  }

  private buildShortUrl(shortCode: string): string {
    return new URL(shortCode, this.baseUrl).toString();
  }

  private toResponse(
    originalUrl: string,
    shortCode: string,
  ): CreateUrlResponseDto {
    return {
      originalUrl,
      shortCode,
      shortUrl: this.buildShortUrl(shortCode),
    };
  }

  private findByOriginalUrlAndStrategy(originalUrl: string, strategy: string) {
    return this.prisma.url.findFirst({
      where: {
        originalUrl,
        strategy,
      },
    });
  }

  private isUniqueConstraintOn(
    error: PrismaClientKnownRequestError,
    fields: string[],
  ): boolean {
    const target = error.meta?.target;
    if (!Array.isArray(target)) {
      return false;
    }

    return (
      fields.length === target.length &&
      fields.every((field) => target.includes(field))
    );
  }

  async create(dto: CreateUrlDto): Promise<CreateUrlResponseDto> {
    const strategy = this.shortCodeGenerator.getStrategy();

    this.logger.debug(
      { originalUrl: dto.originalUrl, strategy },
      URL_CREATE_LOG_MESSAGES.CREATE_STARTED,
    );

    const alias = dto.customAlias?.trim().toLowerCase();

    if (alias) {
      await this.aliasValidator.validate(alias);
    }

    const existing = await this.findByOriginalUrlAndStrategy(
      dto.originalUrl,
      strategy,
    );

    if (existing) {
      this.logger.info(
        {
          id: existing.id,
          shortCode: existing.shortCode,
          strategy,
        },
        URL_CREATE_LOG_MESSAGES.REUSED_EXISTING,
      );

      return this.toResponse(existing.originalUrl, existing.shortCode);
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
        const url = await this.prisma.url.create({
          data: {
            originalUrl: dto.originalUrl,
            shortCode,
            customAlias: alias,
            expiresAt: dto.expiresAt,
            strategy,
          },
        });

        this.logger.info(
          {
            id: url.id,
            shortCode,
            strategy,
            attempt,
          },
          URL_CREATE_LOG_MESSAGES.CREATE_SUCCESS,
        );

        return this.toResponse(url.originalUrl, shortCode);
      } catch (error: unknown) {
        if (
          error instanceof PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          if (this.isUniqueConstraintOn(error, ['originalUrl', 'strategy'])) {
            const concurrent = await this.findByOriginalUrlAndStrategy(
              dto.originalUrl,
              strategy,
            );

            if (concurrent) {
              this.logger.info(
                {
                  id: concurrent.id,
                  shortCode: concurrent.shortCode,
                  strategy,
                },
                URL_CREATE_LOG_MESSAGES.REUSED_EXISTING,
              );

              return this.toResponse(
                concurrent.originalUrl,
                concurrent.shortCode,
              );
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

  async redirect(shortCode: string): Promise<string> {
    this.logger.debug({ shortCode }, URL_REDIRECT_LOG_MESSAGES.RESOLVING_URL);

    try {
      const url = await this.prisma.url.findFirst({
        where: {
          OR: [{ shortCode }, { customAlias: shortCode }],
        },
      });

      if (!url) {
        this.logger.warn(
          { shortCode },
          URL_REDIRECT_ERROR_MESSAGES.URL_NOT_FOUND,
        );

        throw new NotFoundException(URL_REDIRECT_ERROR_MESSAGES.URL_NOT_FOUND);
      }

      if (url.disabled) {
        this.logger.warn(
          { id: url.id, shortCode },
          URL_REDIRECT_ERROR_MESSAGES.URL_DISABLED,
        );
        throw new GoneException(URL_REDIRECT_ERROR_MESSAGES.URL_DISABLED);
      }

      if (url.expiresAt && url.expiresAt <= new Date()) {
        this.logger.warn(
          { id: url.id, shortCode, expiresAt: url.expiresAt },
          URL_REDIRECT_ERROR_MESSAGES.URL_EXPIRED,
        );
        throw new GoneException(URL_REDIRECT_ERROR_MESSAGES.URL_EXPIRED);
      }

      this.logger.info(
        {
          id: url.id,
          shortCode,
        },
        URL_REDIRECT_LOG_MESSAGES.REDIRECT_SUCCESS,
      );

      return url.originalUrl;
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof GoneException
      ) {
        throw error;
      }

      this.logger.error(
        {
          err: error,
          shortCode,
        },
        URL_REDIRECT_ERROR_MESSAGES.RESOLVE_FAILED,
      );

      throw new InternalServerErrorException();
    }
  }
}
