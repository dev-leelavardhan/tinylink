import { GoneException, Injectable } from '@nestjs/common';
import { type CachedIdentifier } from '../../cache/types';
import { URL_REDIRECT_ERROR_MESSAGES } from '../constants/url.constants';

export interface IdentifierState {
  deletedAt: string | Date | null;
  disabled: boolean;
  expiresAt: string | Date | null;
}

@Injectable()
export class UrlStateValidatorService {
  validate(identifier: CachedIdentifier | IdentifierState): void {
    if (identifier.deletedAt) {
      throw new GoneException(URL_REDIRECT_ERROR_MESSAGES.URL_DELETED);
    }

    if (identifier.disabled) {
      throw new GoneException(URL_REDIRECT_ERROR_MESSAGES.URL_DISABLED);
    }

    if (identifier.expiresAt && new Date(identifier.expiresAt) <= new Date()) {
      throw new GoneException(URL_REDIRECT_ERROR_MESSAGES.URL_EXPIRED);
    }
  }
}
