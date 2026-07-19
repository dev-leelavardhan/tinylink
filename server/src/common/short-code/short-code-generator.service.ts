import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AutoIncrementGenerator } from './generators/auto-increment.generator';
import { HashGenerator } from './generators/hash.generator';
import { HashidsGenerator } from './generators/hashids.generator';
import { RandomBase62Generator } from './generators/random-base62.generator';
import { SnowflakeGenerator } from './generators/snowflake.generator';
import {
  ShortCodeGenerateOptions,
  ShortCodeGenerator,
} from './interfaces/short-code-generator.interface';
import {
  SHORT_CODE_CONFIG_KEYS,
  SHORT_CODE_STRATEGIES,
  type ShortCodeStrategy,
} from './short-code.constants';

@Injectable()
export class ShortCodeGeneratorService {
  private readonly strategy: ShortCodeStrategy;
  private readonly generators: Record<ShortCodeStrategy, ShortCodeGenerator>;

  constructor(
    config: ConfigService,
    randomGenerator: RandomBase62Generator,
    hashGenerator: HashGenerator,
    hashidsGenerator: HashidsGenerator,
    snowflakeGenerator: SnowflakeGenerator,
    autoIncrementGenerator: AutoIncrementGenerator,
  ) {
    this.strategy = config.get<ShortCodeStrategy>(
      SHORT_CODE_CONFIG_KEYS.STRATEGY,
      'random',
    );

    if (!SHORT_CODE_STRATEGIES.includes(this.strategy)) {
      throw new Error(
        `Invalid SHORT_CODE_STRATEGY "${this.strategy}". Expected one of: ${SHORT_CODE_STRATEGIES.join(', ')}`,
      );
    }

    this.generators = {
      random: randomGenerator,
      hash: hashGenerator,
      hashids: hashidsGenerator,
      snowflake: snowflakeGenerator,
      'auto-increment': autoIncrementGenerator,
    };
  }

  generate(options: ShortCodeGenerateOptions): Promise<string> | string {
    return this.generators[this.strategy].generate(options);
  }

  getStrategy(): ShortCodeStrategy {
    return this.strategy;
  }
}
