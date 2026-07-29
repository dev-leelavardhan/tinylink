import { z } from 'zod';
import { SHORT_CODE_STRATEGIES } from '../common/short-code/short-code.constants';
import { SERVICE_ROLES } from '../common/service-role/service-role.util';

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    // Process role: `web` serves HTTP, `worker` runs background jobs,
    // `all` (default) runs both in a single process.
    SERVICE_ROLE: z.enum(SERVICE_ROLES).default('all'),

    // Pino log level.
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    DATABASE_URL: z.url(),

    REDIS_URL: z.url(),

    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long'),

    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long'),

    BASE_URL: z.url(),

    SHORT_CODE_STRATEGY: z.enum(SHORT_CODE_STRATEGIES).default('random'),

    SHORT_CODE_LENGTH: z.coerce.number().int().min(4).max(16).default(7),

    SHORT_CODE_HASHIDS_SALT: z.string().min(16).optional(),

    SHORT_CODE_SNOWFLAKE_WORKER_ID: z.coerce
      .number()
      .int()
      .min(0)
      .max(1023)
      .default(1),

    IP_HASH_SALT: z.string().min(16),

    GEOLITE2_DB_PATH: z.string().optional(),

    // CORS configuration
    CORS_ORIGIN: z.string().optional(),

    // Observability (OpenTelemetry). Tracing is enabled only when an OTLP
    // endpoint is configured.
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    OTEL_SERVICE_NAME: z.string().optional(),

    // Mailer configuration
    MAILER_HOST: z.string().min(1, 'MAILER_HOST is required'),
    MAILER_PORT: z.coerce.number().int().default(587),
    MAILER_SECURE: z.enum(['true', 'false']).default('false'),
    MAILER_USER: z.string().min(1, 'MAILER_USER is required'),
    MAILER_PASS: z.string().min(1, 'MAILER_PASS is required'),
    MAILER_FROM: z.string().email('MAILER_FROM must be a valid email'),
    MAILER_NAME: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.SHORT_CODE_STRATEGY === 'hashids' && !env.SHORT_CODE_HASHIDS_SALT) {
      ctx.addIssue({
        code: 'custom',
        path: ['SHORT_CODE_HASHIDS_SALT'],
        message:
          'SHORT_CODE_HASHIDS_SALT is required when SHORT_CODE_STRATEGY=hashids',
      });
    }

    // The snowflake worker id must be unique per replica; refuse to fall back to
    // the shared default when the strategy is actually in use, otherwise codes
    // can collide across instances.
    if (
      env.SHORT_CODE_STRATEGY === 'snowflake' &&
      process.env.SHORT_CODE_SNOWFLAKE_WORKER_ID === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['SHORT_CODE_SNOWFLAKE_WORKER_ID'],
        message:
          'SHORT_CODE_SNOWFLAKE_WORKER_ID must be set explicitly and be unique per replica when SHORT_CODE_STRATEGY=snowflake',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
