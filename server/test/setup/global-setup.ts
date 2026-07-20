import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import './load-env';

export default function globalSetup(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required for integration and e2e tests. Copy .env.test.example to .env.test, then run: pnpm test:db:up',
    );
  }

  execSync('pnpm exec prisma migrate deploy', {
    cwd: resolve(__dirname, '../..'),
    stdio: 'inherit',
    env: process.env,
  });
}
