import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();

    const record = () => {
      const route = this.resolveRoute(req);
      // Do not record scrapes of the metrics endpoint itself.
      if (route === '/metrics') {
        return;
      }
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.observeHttpRequest(
        req.method,
        route,
        res.statusCode,
        durationSeconds,
      );
    };

    return next.handle().pipe(
      tap({
        next: record,
        error: record,
      }),
    );
  }

  /**
   * Prefer the matched route pattern (e.g. `/:shortCode`) over the raw path to
   * keep metric label cardinality bounded.
   */
  private resolveRoute(req: Request): string {
    const routePath = (req.route as { path?: string } | undefined)?.path;
    if (routePath) {
      const base = req.baseUrl || '';
      return `${base}${routePath}` || routePath;
    }
    return 'unmatched';
  }
}
