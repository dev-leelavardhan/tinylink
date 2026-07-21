import { GoneException, Injectable } from '@nestjs/common';
import { CachedUrl } from '../../redis/redis.interface';
import { Url } from '../urls.interface';
import { URL_REDIRECT_ERROR_MESSAGES } from '../constants/url.constants';

@Injectable()
export class UrlStateValidatorService {
  validate(url: CachedUrl | Url): void {
    if (url.disabled) {
      throw new GoneException(URL_REDIRECT_ERROR_MESSAGES.URL_DISABLED);
    }

    if (url.expiresAt && new Date(url.expiresAt) <= new Date()) {
      throw new GoneException(URL_REDIRECT_ERROR_MESSAGES.URL_EXPIRED);
    }
  }
}
