import { describe, expect, it } from 'vitest';
import { getRequiredEnv } from './env';

describe('getRequiredEnv', () => {
  it('returns the value when the variable is set', () => {
    expect(getRequiredEnv('ENCRYPTION_KEY', { ENCRYPTION_KEY: 'abc' })).toBe('abc');
  });

  it('throws when the variable is missing', () => {
    expect(() => getRequiredEnv('ENCRYPTION_KEY', {})).toThrow(
      'ENCRYPTION_KEY environment variable is required',
    );
  });

  it('throws when the variable is empty', () => {
    expect(() => getRequiredEnv('ENCRYPTION_KEY', { ENCRYPTION_KEY: '' })).toThrow(
      'ENCRYPTION_KEY environment variable is required',
    );
  });
});
