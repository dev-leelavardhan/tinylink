import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

import { ShortCodeGenerator } from '../interfaces/short-code-generator.interface';
import {
  RANDOM_BASE_CONSTANTS,
  SHORT_CODE_CONFIG_KEYS,
} from '../short-code.constants';

@Injectable()
export class RandomBase62Generator implements ShortCodeGenerator {
  private readonly length: number;

  constructor(private readonly config: ConfigService) {
    this.length = this.config.get<number>(
      SHORT_CODE_CONFIG_KEYS.LENGTH,
      RANDOM_BASE_CONSTANTS.SHORT_CODE_LENGTH,
    );
  }

  generate(): string {
    const { RANDOM_BASE, RANDOM_BASE_LENGTH } = RANDOM_BASE_CONSTANTS;
    let code = '';

    for (let i = 0; i < this.length; i++) {
      code += RANDOM_BASE[randomInt(RANDOM_BASE_LENGTH)];
    }

    return code;
  }
}
