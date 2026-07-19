import { Module } from '@nestjs/common';

import { AutoIncrementGenerator } from './generators/auto-increment.generator';
import { HashGenerator } from './generators/hash.generator';
import { HashidsGenerator } from './generators/hashids.generator';
import { RandomBase62Generator } from './generators/random-base62.generator';
import { SnowflakeGenerator } from './generators/snowflake.generator';
import { ShortCodeCounterService } from './short-code-counter.service';
import { ShortCodeGeneratorService } from './short-code-generator.service';

@Module({
  providers: [
    ShortCodeCounterService,
    RandomBase62Generator,
    HashGenerator,
    HashidsGenerator,
    AutoIncrementGenerator,
    SnowflakeGenerator,
    ShortCodeGeneratorService,
  ],
  exports: [ShortCodeGeneratorService],
})
export class ShortCodeModule {}
