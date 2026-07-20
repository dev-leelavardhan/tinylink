import { encodeBase62 } from './base62';

describe('encodeBase62 (unit)', () => {
  it('encodes zero as the first alphabet character', () => {
    expect(encodeBase62(0)).toBe('0');
  });

  it('encodes positive integers', () => {
    expect(encodeBase62(1)).toBe('1');
    expect(encodeBase62(62)).toBe('10');
    expect(encodeBase62(3844)).toBe('100');
  });

  it('throws for negative numbers', () => {
    expect(() => encodeBase62(-1)).toThrow(
      'Cannot encode negative numbers as base62',
    );
  });
});
