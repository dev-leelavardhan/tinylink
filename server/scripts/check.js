#!/usr/bin/env node

const { execSync } = require('child_process');

const checks = [
  { name: 'Lint', cmd: 'pnpm lint:check' },
  { name: 'Typecheck', cmd: 'pnpm typecheck' },
  { name: 'Unit Tests', cmd: 'pnpm test' },
  { name: 'Integration Tests', cmd: 'pnpm test:integration' },
  { name: 'E2E Tests', cmd: 'pnpm test:e2e' },
];

const results = [];

for (const check of checks) {
  const start = Date.now();
  try {
    execSync(check.cmd, { stdio: 'inherit', cwd: __dirname + '/..' });
    results.push({ name: check.name, status: 'PASS', duration: Date.now() - start });
  } catch {
    results.push({ name: check.name, status: 'FAIL', duration: Date.now() - start });
  }
}

console.log('\n' + '='.repeat(50));
console.log('RESULTS');
console.log('='.repeat(50));

for (const r of results) {
  const icon = r.status === 'PASS' ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  const time = (r.duration / 1000).toFixed(1);
  console.log(`  ${icon} ${r.name.padEnd(22)} ${r.status.padEnd(5)} ${time}s`);
}

console.log('='.repeat(50));

const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL').length;

if (failed > 0) {
  console.log(`\x1b[31m${failed} failed, ${passed} passed\x1b[0m`);
  process.exit(1);
} else {
  console.log(`\x1b[32mAll ${passed} checks passed\x1b[0m`);
}
