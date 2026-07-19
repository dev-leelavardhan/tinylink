import { Injectable } from '@nestjs/common';

import { ShortCodeGenerator } from '../interfaces/short-code-generator.interface';
import { ShortCodeCounterService } from '../short-code-counter.service';
import { encodeBase62 } from '../utils/base62';

@Injectable()
export class AutoIncrementGenerator implements ShortCodeGenerator {
  constructor(private readonly counter: ShortCodeCounterService) {}

  async generate(): Promise<string> {
    const id = await this.counter.next();
    return encodeBase62(id);
  }
}
