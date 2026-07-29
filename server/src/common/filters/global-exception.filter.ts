import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

const SECURITY_4XX_EVENTS = new Set([401, 403, 429]);

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        const raw = responseObj.message;
        message =
          typeof raw === 'string'
            ? raw
            : Array.isArray(raw)
              ? (raw as string[]).join(', ')
              : message;
      }
    }

    // Log all 5xx errors in every environment
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      // In production, sanitize the message sent to the client
      if (process.env.NODE_ENV === 'production') {
        message = 'Internal server error';
      }

      this.logger.error(
        {
          err: exception,
          path: request.url,
          method: request.method,
          statusCode: status,
        },
        'Unhandled exception',
      );
    }

    // Log security-relevant 4xx events (auth failures, rate limiting)
    if (SECURITY_4XX_EVENTS.has(status)) {
      this.logger.warn(
        {
          path: request.url,
          method: request.method,
          statusCode: status,
          ip: request.ip,
        },
        'Security event',
      );
    }

    const requestId = request.headers
      ? ((request.headers['x-request-id'] as string) ?? undefined)
      : undefined;

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(requestId ? { requestId } : {}),
    });
  }
}
