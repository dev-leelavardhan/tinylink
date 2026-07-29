import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ShortCodeGenerateOptions,
  ShortCodeGenerator,
} from '../interfaces/short-code-generator.interface';
import {
  SHORT_CODE_CONFIG_KEYS,
  SNOWFLAKE_EPOCH_MS,
  SNOWFLAKE_MAX_SEQUENCE,
  SNOWFLAKE_MAX_WORKER_ID,
  SNOWFLAKE_SEQUENCE_BITS,
  SNOWFLAKE_WORKER_BITS,
} from '../short-code.constants';
import { encodeBase62 } from '../utils/base62';

/**
 * In-memory snowflake generator. The worker id MUST be unique per running
 * instance (see env validation for SHORT_CODE_SNOWFLAKE_WORKER_ID); two replicas
 * sharing a worker id can produce colliding ids. Inject a distinct id per
 * replica (e.g. from the orchestrator's pod ordinal).
 */
@Injectable()
export class SnowflakeGenerator implements ShortCodeGenerator {
  private readonly workerId: bigint;
  private lastTimestamp = -1n;
  private sequence = 0n;

  constructor(private readonly config: ConfigService) {
    const workerId = BigInt(
      this.config.get<number>(SHORT_CODE_CONFIG_KEYS.SNOWFLAKE_WORKER_ID, 1),
    );

    if (workerId < 0n || workerId > SNOWFLAKE_MAX_WORKER_ID) {
      throw new Error(
        `SHORT_CODE_SNOWFLAKE_WORKER_ID must be between 0 and ${SNOWFLAKE_MAX_WORKER_ID}`,
      );
    }

    this.workerId = workerId;
  }

  generate(_options?: ShortCodeGenerateOptions): string {
    const id = this.nextId();
    return encodeBase62(id);
  }

  private nextId(): bigint {
    let timestamp = this.currentTimestamp();

    if (timestamp < this.lastTimestamp) {
      throw new Error(
        'Clock moved backwards; refusing to generate snowflake id',
      );
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & SNOWFLAKE_MAX_SEQUENCE;
      if (this.sequence === 0n) {
        timestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    return (
      (timestamp << (SNOWFLAKE_WORKER_BITS + SNOWFLAKE_SEQUENCE_BITS)) |
      (this.workerId << SNOWFLAKE_SEQUENCE_BITS) |
      this.sequence
    );
  }

  private currentTimestamp(): bigint {
    return BigInt(Date.now()) - SNOWFLAKE_EPOCH_MS;
  }

  private waitNextMillis(lastTimestamp: bigint): bigint {
    let timestamp = this.currentTimestamp();
    while (timestamp <= lastTimestamp) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1);
      timestamp = this.currentTimestamp();
    }
    return timestamp;
  }
}
