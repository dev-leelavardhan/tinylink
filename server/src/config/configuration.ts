import { z } from 'zod';
import { envSchema } from './env.schema';

export default () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(
      `Environment validation failed\n\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
};
