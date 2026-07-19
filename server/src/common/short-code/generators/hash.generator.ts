import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ShortCodeGenerateOptions,
  ShortCodeGenerator,
} from '../interfaces/short-code-generator.interface';
import {
  RANDOM_BASE_CONSTANTS,
  SHORT_CODE_CONFIG_KEYS,
} from '../short-code.constants';

@Injectable()
export class HashGenerator implements ShortCodeGenerator {
  private readonly length: number;

  constructor(private readonly config: ConfigService) {
    this.length = this.config.get<number>(
      SHORT_CODE_CONFIG_KEYS.LENGTH,
      RANDOM_BASE_CONSTANTS.SHORT_CODE_LENGTH,
    );
  }

  generate(options: ShortCodeGenerateOptions): string {
    const attempt = options.attempt ?? 1;
    const payload = `${options.originalUrl}\0${attempt}`;
    const digest = createHash('sha256').update(payload).digest();

    const { RANDOM_BASE, RANDOM_BASE_LENGTH } = RANDOM_BASE_CONSTANTS;
    let code = '';

    for (let i = 0; i < this.length; i++) {
      code += RANDOM_BASE[digest[i] % RANDOM_BASE_LENGTH];
    }

    return code;
  }
}
