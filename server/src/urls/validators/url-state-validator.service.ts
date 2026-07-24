import { GoneException, Injectable } from '@nestjs/common';
import { type CachedUrl } from '../../cache/types';
import { type Url } from '../types';
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
