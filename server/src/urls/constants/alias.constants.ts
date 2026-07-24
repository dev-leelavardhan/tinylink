export const RESERVED_ALIASES = new Set([
  'api',
  'auth',
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
