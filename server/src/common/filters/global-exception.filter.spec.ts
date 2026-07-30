import { HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';

import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { url: string; method: string };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockRequest = {
      url: '/test',
      method: 'GET',
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should handle HttpException with string message', () => {
    const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Test error',
      }),
    );
  });

  it('should handle HttpException with object response', () => {
    const exception = new HttpException(
      { message: 'Validation failed' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Validation failed',
      }),
    );
  });

  it('should handle HttpException with object response without message', () => {
    const exception = new HttpException(
      { error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
      }),
    );
  });

  it('should handle HttpException with array message', () => {
    const exception = new HttpException(
      { message: ['Error 1', 'Error 2'] },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Error 1, Error 2',
      }),
    );
  });

  it('should sanitize unknown errors to 500', () => {
    const exception = new Error('Internal error details');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
    );
  });

  it('should include timestamp and path in response', () => {
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/test',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        timestamp: expect.any(String),
      }),
    );
  });

  it('should sanitize 500 error message in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const exception = new Error('Secret internal details');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('should include requestId when x-request-id header is present', () => {
    const mockRequestWithId = {
      url: '/test',
      method: 'GET',
      headers: { 'x-request-id': 'req-123' },
      ip: '127.0.0.1',
    };

    const mockHostWithHeaders = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequestWithId,
      }),
    } as unknown as ArgumentsHost;

    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHostWithHeaders);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-123',
      }),
    );
  });

  it('should not include requestId when header is missing', () => {
    const mockRequestNoHeaders = {
      url: '/test',
      method: 'GET',
      headers: {},
    };

    const mockHostNoHeaders = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequestNoHeaders,
      }),
    } as unknown as ArgumentsHost;

    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHostNoHeaders);

    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.not.objectContaining({
        requestId: expect.anything(),
      }),
    );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  });

  it('should handle 401 Unauthorized with correct status', () => {
    const exception = new HttpException(
      'Unauthorized',
      HttpStatus.UNAUTHORIZED,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: 'Unauthorized',
      }),
    );
  });

  it('should handle 403 Forbidden with correct status', () => {
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'Forbidden',
      }),
    );
  });

  it('should handle 429 Too Many Requests with correct status', () => {
    const exception = new HttpException(
      'Rate limited',
      HttpStatus.TOO_MANY_REQUESTS,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(429);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 429,
        message: 'Rate limited',
      }),
    );
  });

  it('should handle 502 Bad Gateway as 5xx error', () => {
    const exception = new HttpException('Bad Gateway', HttpStatus.BAD_GATEWAY);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(502);
  });

  it('should handle 503 Service Unavailable as 5xx error', () => {
    const exception = new HttpException(
      'Service Unavailable',
      HttpStatus.SERVICE_UNAVAILABLE,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(503);
  });
});
