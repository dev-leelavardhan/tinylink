import {
  GoneException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { UrlCacheService } from '../service/urls-cache.service';
import {
  URL_REDIRECT_LOG_MESSAGES,
  URL_REDIRECT_ERROR_MESSAGES,
} from '../constants/url.constants';
import { UrlRepository } from '../repositories/url.repository';
import { IdentifierRepository } from '../repositories/identifier.repository';
import { UrlMapper } from '../mappers/urls.mapper';
import { UrlStateValidatorService } from '../validators/url-state-validator.service';
import { AnalyticsQueue } from '../../analytics/queue/analytics.queue';
import { type ClickJobData } from '../../analytics/types';

@Injectable()
export class UrlRedirectService {
  constructor(
    private readonly cache: UrlCacheService,
    private readonly urlRepository: UrlRepository,
    private readonly identifierRepository: IdentifierRepository,
    private readonly urlMapper: UrlMapper,
    private readonly validator: UrlStateValidatorService,
    private readonly logger: PinoLogger,
    private readonly analyticsQueue: AnalyticsQueue,
  ) {
    this.logger.setContext(UrlRedirectService.name);
  }

  async redirect(
    code: string,
    requestMeta?: {
      userAgent: string;
      referrer?: string;
      ip?: string;
    },
  ): Promise<string> {
    try {
      const cached = await this.cache.get(code);

      if (cached.status === 'hit') {
        this.validator.validate(cached.data);

        this.logger.info(
          { id: cached.data.id, code, cached: true },
          URL_REDIRECT_LOG_MESSAGES.REDIRECT_SUCCESS,
        );

        this.enqueueClick(cached.data.urlId, cached.data.id, code, requestMeta);

        return cached.data.originalUrl;
      }

      if (cached.status === 'negative') {
        throw new NotFoundException(URL_REDIRECT_ERROR_MESSAGES.URL_NOT_FOUND);
      }

      // Cache miss — look up via Identifier
      const identifier =
        await this.identifierRepository.findByIdentifierCode(code);

      if (!identifier || identifier.deletedAt) {
        await this.cache.setNegative(code);
        throw new NotFoundException(URL_REDIRECT_ERROR_MESSAGES.URL_NOT_FOUND);
      }

      this.validator.validate(identifier);

      const url = await this.urlRepository.findById(identifier.urlId);

      if (!url) {
        await this.cache.setNegative(code);
        throw new NotFoundException(URL_REDIRECT_ERROR_MESSAGES.URL_NOT_FOUND);
      }

      // Cache the identifier
      const cachedData = this.urlMapper.toCached(url, identifier);
      await this.cache.set(code, cachedData);

      this.logger.info(
        { id: identifier.id, code },
        URL_REDIRECT_LOG_MESSAGES.REDIRECT_SUCCESS,
      );

      this.enqueueClick(url.id, identifier.id, code, requestMeta);

      return url.originalUrl;
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof GoneException
      ) {
        throw error;
      }

      this.logger.error(
        { err: error, code },
        URL_REDIRECT_ERROR_MESSAGES.RESOLVE_FAILED,
      );

      throw new InternalServerErrorException();
    }
  }

  private enqueueClick(
    urlId: string,
    identifierId: string,
    code: string,
    requestMeta?: {
      userAgent: string;
      referrer?: string;
      ip?: string;
    },
  ): void {
    this.analyticsQueue
      .add('click', {
        urlId,
        identifierId,
        shortCode: code,
        userAgent: requestMeta?.userAgent ?? '',
        referrer: requestMeta?.referrer,
        ip: requestMeta?.ip,
      } satisfies ClickJobData)
      .catch((err: unknown) => {
        this.logger.warn({ err, code }, 'Failed to enqueue analytics');
      });
  }
}
