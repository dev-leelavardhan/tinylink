import { RANDOM_BASE_CONSTANTS } from '../short-code.constants';

const { RANDOM_BASE: ALPHABET, RANDOM_BASE_LENGTH: BASE } =
  RANDOM_BASE_CONSTANTS;

export function encodeBase62(value: bigint | number): string {
  let num = typeof value === 'number' ? BigInt(value) : value;

  if (num < 0n) {
    throw new Error('Cannot encode negative numbers as base62');
  }

  if (num === 0n) {
    return ALPHABET[0];
  }

  let result = '';
  const base = BigInt(BASE);

  while (num > 0n) {
    result = ALPHABET[Number(num % base)] + result;
    num /= base;
  }

  return result;
}
