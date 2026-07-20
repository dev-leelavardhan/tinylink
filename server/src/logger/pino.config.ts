import { Params } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';

export const pinoConfig: Params = {
  pinoHttp: {
    genReqId: (req, res) => {
      const existing = req.headers['x-request-id'];

      const requestId = typeof existing === 'string' ? existing : randomUUID();

      res.setHeader('x-request-id', requestId);

      return requestId;
    },

    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,

    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie'],
      remove: true,
    },
  },
};
