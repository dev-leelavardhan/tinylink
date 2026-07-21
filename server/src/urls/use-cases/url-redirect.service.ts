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
import { UrlMapper } from '../mappers/urls.mapper';
import { UrlStateValidatorService } from '../validators/url-state-validator.service';

@Injectable()
export class UrlRedirectService {
  constructor(
    private readonly cache: UrlCacheService,
    private readonly urlRepository: UrlRepository,
    private readonly urlMapper: UrlMapper,
    private readonly validator: UrlStateValidatorService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UrlRedirectService.name);
  }

  async redirect(shortCode: string): Promise<string> {
    this.logger.debug({ shortCode }, URL_REDIRECT_LOG_MESSAGES.RESOLVING_URL);

    try {
      const cached = await this.cache.get(shortCode);

      if (cached) {
        this.validator.validate(cached);

        this.logger.info(
          {
            id: cached.id,
            shortCode,
            cached: true,
          },
          URL_REDIRECT_LOG_MESSAGES.REDIRECT_SUCCESS,
        );

        return cached.originalUrl;
      }

      const url = await this.urlRepository.findByShortCodeOrAlias(shortCode);

      if (!url) {
        await this.cache.setNegative(shortCode);
        throw new NotFoundException(URL_REDIRECT_ERROR_MESSAGES.URL_NOT_FOUND);
      }
      this.validator.validate(url);

      const cachedUrl = this.urlMapper.toCached(url);
      await this.cache.set(shortCode, cachedUrl);

      if (url.customAlias && url.customAlias !== shortCode) {
        await this.cache.set(url.customAlias, cachedUrl);
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
