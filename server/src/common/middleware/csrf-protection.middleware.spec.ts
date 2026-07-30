import type { Request, Response, NextFunction } from 'express';

import { CsrfProtectionMiddleware } from './csrf-protection.middleware';

describe('CsrfProtectionMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockNext: NextFunction;
  const originalEnv = process.env;

  beforeEach(() => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should call next() in development mode', () => {
    process.env.BASE_URL = 'https://example.com';
    process.env.NODE_ENV = 'development';
    mockRequest = { headers: {} };

    CsrfProtectionMiddleware(
      mockRequest as Request,
      mockResponse as unknown as Response,
      mockNext,
    );

    expect(mockNext).toHaveBeenCalled();
  });

  it('should return 500 when BASE_URL is not set in production', () => {
    delete process.env.BASE_URL;
    process.env.NODE_ENV = 'production';
    mockRequest = { headers: {} };

    CsrfProtectionMiddleware(
      mockRequest as Request,
      mockResponse as unknown as Response,
      mockNext,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request without Origin header in production', () => {
    process.env.BASE_URL = 'https://example.com';
    process.env.NODE_ENV = 'production';
    mockRequest = { headers: {} };

    CsrfProtectionMiddleware(
      mockRequest as Request,
      mockResponse as unknown as Response,
      mockNext,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request with mismatched origin in production', () => {
    process.env.BASE_URL = 'https://example.com';
    process.env.NODE_ENV = 'production';
    mockRequest = {
      headers: { origin: 'https://evil.com' },
    };

    CsrfProtectionMiddleware(
      mockRequest as Request,
      mockResponse as unknown as Response,
      mockNext,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should accept request with matching origin in production', () => {
    process.env.BASE_URL = 'https://example.com';
    process.env.NODE_ENV = 'production';
    mockRequest = {
      headers: { origin: 'https://example.com' },
    };

    CsrfProtectionMiddleware(
      mockRequest as Request,
      mockResponse as unknown as Response,
      mockNext,
    );

    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should reject request with only Referer header (no Origin)', () => {
    process.env.BASE_URL = 'https://example.com';
    process.env.NODE_ENV = 'production';
    mockRequest = {
      headers: { referer: 'https://example.com/some-page' },
    };

    CsrfProtectionMiddleware(
      mockRequest as Request,
      mockResponse as unknown as Response,
      mockNext,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle array origin header', () => {
    process.env.BASE_URL = 'https://example.com';
    process.env.NODE_ENV = 'production';
    mockRequest = {
      headers: { origin: ['https://example.com'] as unknown as string },
    };

    CsrfProtectionMiddleware(
      mockRequest as Request,
      mockResponse as unknown as Response,
      mockNext,
    );

    expect(mockNext).toHaveBeenCalled();
  });

  it('should reject request with invalid origin URL in production', () => {
    process.env.BASE_URL = 'https://example.com';
    process.env.NODE_ENV = 'production';
    mockRequest = {
      headers: { origin: 'not-a-valid-url' },
    };

    CsrfProtectionMiddleware(
      mockRequest as Request,
      mockResponse as unknown as Response,
      mockNext,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should skip CSRF in test mode', () => {
    process.env.BASE_URL = 'https://example.com';
    process.env.NODE_ENV = 'test';
    mockRequest = { headers: {} };

    CsrfProtectionMiddleware(
      mockRequest as Request,
      mockResponse as unknown as Response,
      mockNext,
    );

    expect(mockNext).toHaveBeenCalled();
  });
});
