import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Hashids from 'hashids';

import {
  ShortCodeGenerateOptions,
  ShortCodeGenerator,
} from '../interfaces/short-code-generator.interface';
import { ShortCodeCounterService } from '../short-code-counter.service';
import {
  RANDOM_BASE_CONSTANTS,
  SHORT_CODE_CONFIG_KEYS,
} from '../short-code.constants';

@Injectable()
export class HashidsGenerator implements ShortCodeGenerator {
  private hashids: Hashids | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly counter: ShortCodeCounterService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generate(options?: ShortCodeGenerateOptions): Promise<string> {
    const id = await this.counter.next();
    return this.getHashids().encode(id);
  }

  private getHashids(): Hashids {
    if (!this.hashids) {
      const salt = this.config.getOrThrow<string>(
        SHORT_CODE_CONFIG_KEYS.HASHIDS_SALT,
      );
      const minLength = this.config.get<number>(
        SHORT_CODE_CONFIG_KEYS.LENGTH,
        RANDOM_BASE_CONSTANTS.SHORT_CODE_LENGTH,
      );

      this.hashids = new Hashids(
        salt,
        minLength,
        RANDOM_BASE_CONSTANTS.RANDOM_BASE,
      );
    }

    return this.hashids;
  }
}
