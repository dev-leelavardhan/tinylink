import { pinoConfig } from './pino.config';

describe('pinoConfig (unit)', () => {
  it('exports a valid pino config object', () => {
    expect(pinoConfig).toBeDefined();
    expect(pinoConfig.pinoHttp).toBeDefined();
  });

  it('has redact paths for authorization and cookie', () => {
    const redact = (pinoConfig.pinoHttp as Record<string, unknown>).redact as {
      paths: string[];
      remove: boolean;
    };

    expect(redact.paths).toContain('req.headers.authorization');
    expect(redact.paths).toContain('req.headers.cookie');
    expect(redact.remove).toBe(true);
  });

  describe('genReqId', () => {
    it('uses existing x-request-id header when present', () => {
      const pinoHttp = pinoConfig.pinoHttp as Record<string, unknown>;
      const genReqId = pinoHttp.genReqId as (
        req: { headers: Record<string, string> },
        res: { setHeader: jest.Mock },
      ) => string;

      const req = { headers: { 'x-request-id': 'my-trace-id' } };
      const res = { setHeader: jest.fn() };

      const result = genReqId(req, res);

      expect(result).toBe('my-trace-id');
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'my-trace-id');
    });

    it('generates a UUID when no x-request-id header', () => {
      const pinoHttp = pinoConfig.pinoHttp as Record<string, unknown>;
      const genReqId = pinoHttp.genReqId as (
        req: { headers: Record<string, undefined> },
        res: { setHeader: jest.Mock },
      ) => string;

      const req = { headers: {} };
      const res = { setHeader: jest.fn() };

      const result = genReqId(req, res);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', result);
    });
  });

  describe('transport', () => {
    it('configures pino-pretty when not in production', () => {
      const pinoHttp = pinoConfig.pinoHttp as Record<string, unknown>;
      const transport = pinoHttp.transport as
        | {
            target: string;
            options: Record<string, unknown>;
          }
        | undefined;

      // transport is only set when NODE_ENV !== 'production'
      if (process.env.NODE_ENV !== 'production') {
        expect(transport).toBeDefined();
        expect(transport!.target).toBe('pino-pretty');
        expect(transport!.options.colorize).toBe(true);
      } else {
        expect(transport).toBeUndefined();
      }
    });
  });
});
