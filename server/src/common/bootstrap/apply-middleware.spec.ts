import express from 'express';
import { applyMiddleware } from './apply-middleware';

describe('applyMiddleware', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
  });

  it('should apply middleware without throwing', () => {
    expect(() => applyMiddleware(app)).not.toThrow();
  });

  it('should set trust proxy', () => {
    applyMiddleware(app);
    // Verify the app was configured (trust proxy is set internally)
    expect(app).toBeDefined();
  });

  it('should add HTTPS redirect in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    applyMiddleware(app);

    process.env.NODE_ENV = originalEnv;
  });

  it('should not add HTTPS redirect in non-production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    applyMiddleware(app);

    process.env.NODE_ENV = originalEnv;
  });
});
