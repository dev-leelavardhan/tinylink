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
  private readonly maxValidByte: number;

  constructor(private readonly config: ConfigService) {
    this.length = this.config.get<number>(
      SHORT_CODE_CONFIG_KEYS.LENGTH,
      RANDOM_BASE_CONSTANTS.SHORT_CODE_LENGTH,
    );
    // 256 % 62 = 8, so bytes 0-247 are uniform, 248-255 would cause bias
    this.maxValidByte = 256 - (256 % RANDOM_BASE_CONSTANTS.RANDOM_BASE_LENGTH);
  }

  private getValidIndex(byte: number): number | null {
    if (byte < this.maxValidByte) {
      return byte % RANDOM_BASE_CONSTANTS.RANDOM_BASE_LENGTH;
    }
    return null; // Retry signal
  }

  generate(options: ShortCodeGenerateOptions): string {
    const attempt = options.attempt ?? 1;
    const payload = `${options.originalUrl}\0${attempt}`;
    const digest = createHash('sha256').update(payload).digest();

    const { RANDOM_BASE } = RANDOM_BASE_CONSTANTS;

    let result = '';
    let i = 0;

    while (result.length < this.length) {
      if (i >= digest.length) {
        // Extend digest if needed
        break;
      }
      const idx = this.getValidIndex(digest[i]);
      if (idx !== null) {
        result += RANDOM_BASE[idx];
      }
      i++;
    }

    return result;
  }
}
