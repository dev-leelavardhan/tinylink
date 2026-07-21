import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { isUniqueConstraintOn } from './helpers';

describe('isUniqueConstraintOn', () => {
  function makeError(target: unknown): PrismaClientKnownRequestError {
    return new PrismaClientKnownRequestError('test', {
      code: 'P2002',
      clientVersion: '7.8.0',
      meta: { target },
    });
  }

  it('returns true when target matches fields exactly', () => {
    const error = makeError(['originalUrl', 'strategy']);
    expect(isUniqueConstraintOn(error, ['originalUrl', 'strategy'])).toBe(true);
  });

  it('returns false when target has different fields', () => {
    const error = makeError(['shortCode']);
    expect(isUniqueConstraintOn(error, ['originalUrl', 'strategy'])).toBe(false);
  });

  it('returns false when target is not an array', () => {
    const error = makeError('shortCode');
    expect(isUniqueConstraintOn(error, ['shortCode'])).toBe(false);
  });

  it('returns false when target is undefined', () => {
    const error = makeError(undefined);
    expect(isUniqueConstraintOn(error, ['shortCode'])).toBe(false);
  });

  it('returns false when fields is empty but target has values', () => {
    const error = makeError(['shortCode']);
    expect(isUniqueConstraintOn(error, [])).toBe(false);
  });

  it('returns true when both fields and target are empty arrays', () => {
    const error = makeError([]);
    expect(isUniqueConstraintOn(error, [])).toBe(true);
  });

  it('returns false when target has extra fields', () => {
    const error = makeError(['shortCode', 'extra']);
    expect(isUniqueConstraintOn(error, ['shortCode'])).toBe(false);
  });
});
