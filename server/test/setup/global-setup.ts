import { execFileSync } from 'node:child_process';
import { resolve, delimiter } from 'node:path';

import './load-env';

const SYSTEM_PATHS = [
  process.env.SYSTEMROOT && `${process.env.SYSTEMROOT}\\System32`,
  process.env.SYSTEMROOT && `${process.env.SYSTEMROOT}`,
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
].filter(Boolean);

export default function globalSetup(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required for integration and e2e tests. Copy .env.test.example to .env.test, then run: pnpm test:db:up',
    );
  }

  const prismaBin = resolve(
    __dirname,
    '../../node_modules/prisma/build/index.js',
  );

  execFileSync(process.execPath, [prismaBin, 'migrate', 'deploy'], {
    cwd: resolve(__dirname, '../..'),
    stdio: 'inherit',
    env: { ...process.env, PATH: SYSTEM_PATHS.join(delimiter) },
  });
}
