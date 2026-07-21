import { z } from 'zod';
import { envSchema } from './env.schema';

const configuration = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(
      `Environment validation failed\n\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
};

export default configuration;
