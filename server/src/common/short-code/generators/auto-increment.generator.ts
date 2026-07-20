import { Injectable } from '@nestjs/common';

import {
  ShortCodeGenerateOptions,
  ShortCodeGenerator,
} from '../interfaces/short-code-generator.interface';
import { ShortCodeCounterService } from '../short-code-counter.service';
import { encodeBase62 } from '../utils/base62';

@Injectable()
export class AutoIncrementGenerator implements ShortCodeGenerator {
  constructor(private readonly counter: ShortCodeCounterService) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generate(options?: ShortCodeGenerateOptions): Promise<string> {
    const id = await this.counter.next();
    return encodeBase62(id);
  }
}
