// Includes every top-level application route so a generated code or custom
// alias can never shadow (or be shadowed by) a real endpoint. The root
// `@Get(':shortCode')` redirect route is registered after the feature modules,
// so real routes always win, but reserving the names keeps behaviour obvious.
export const RESERVED_ALIASES = new Set([
  'api',
  'auth',
  'users',
  'login',
  'logout',
  'register',
  'admin',
  'urls',
  'health',
  'metrics',
  'swagger',
  'docs',
  'favicon.ico',
  'robots.txt',
]);

export const ALIAS_REGEX = /^[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)*$/;

export const MIN_ALIAS_LENGTH = 3;

export const MAX_ALIAS_LENGTH = 30;
