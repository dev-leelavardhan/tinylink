import type { Request, Response, NextFunction } from 'express';

import { HttpsRedirectMiddleware } from './https-redirect.middleware';

describe('HttpsRedirectMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: { redirect: jest.Mock };
  let mockNext: NextFunction;

  beforeEach(() => {
    mockResponse = {
      redirect: jest.fn(),
    };
    mockNext = jest.fn();
  });

  it('should call next() if already secure (req.secure)', () => {
    mockRequest = {
      secure: true,
      headers: { host: 'example.com' },
      url: '/test',
    };

    HttpsRedirectMiddleware(
      mockRequest as Request,
      mockResponse as unknown as Response,
      mockNext,
    );

    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.redirect).not.toHaveBeenCalled();
  });

  it('should call next() if X-Forwarded-Proto is https', () => {
    mockRequest = {
      secure: false,
      headers: { host: 'example.com', 'x-forwarded-proto': 'https' },
      url: '/test',
    };

    HttpsRedirectMiddleware(
      mockRequest as Request,
      mockResponse as unknown as Response,
      mockNext,
    );

    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.redirect).not.toHaveBeenCalled();
  });

  it('should redirect to HTTPS if not secure', () => {
    mockRequest = {
      secure: false,
      headers: { host: 'example.com' },
      url: '/test',
    };

    HttpsRedirectMiddleware(
      mockRequest as Request,
      mockResponse as unknown as Response,
      mockNext,
    );

    expect(mockResponse.redirect).toHaveBeenCalledWith(
      301,
      'https://example.com/test',
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should redirect to the BASE_URL host, ignoring a spoofed Host header', () => {
    const previous = process.env.BASE_URL;
    process.env.BASE_URL = 'https://api.tinylink.test';

    mockRequest = {
      secure: false,
      headers: { host: 'evil.example.com' },
      url: '/test',
    };

    try {
      HttpsRedirectMiddleware(
        mockRequest as Request,
        mockResponse as unknown as Response,
        mockNext,
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        301,
        'https://api.tinylink.test/test',
      );
    } finally {
      process.env.BASE_URL = previous;
    }
  });
});
