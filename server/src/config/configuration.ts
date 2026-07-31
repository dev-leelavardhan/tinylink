import { envSchema } from './env.schema';
import { z } from 'zod';

export default () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      `Environment validation failed\n\n${z.prettifyError(parsed.error)}`,
    );
  }

  return parsed.data;
};
