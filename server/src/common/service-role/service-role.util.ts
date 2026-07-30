import { ConfigService } from '@nestjs/config';

export const SERVICE_ROLES = ['web', 'worker', 'all'] as const;
export type ServiceRole = (typeof SERVICE_ROLES)[number];

export function getServiceRole(config: ConfigService): ServiceRole {
  return config.get<ServiceRole>('SERVICE_ROLE', 'all');
}

/**
 * Background workers and schedulers run only in the `worker` and `all` roles,
 * so a `web`-only replica never competes for the event loop with job processing.
 */
export function shouldRunWorkers(config: ConfigService): boolean {
  return getServiceRole(config) !== 'web';
}
