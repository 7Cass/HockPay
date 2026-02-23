import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { ITokenGeneratorPort } from '@hockpay/core';

/**
 * Infrastructure implementation of ITokenGeneratorPort.
 *
 * This service generates cryptographically secure random tokens
 * for use cases like refresh tokens, API keys, etc.
 */
@Injectable()
export class TokenGeneratorService implements ITokenGeneratorPort {
  generate(bytes: number = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  generateBase64(bytes: number = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  /**
   * Generate a hash of a string (useful for storing sensitive tokens).
   * This uses SHA-256 and returns a hexadecimal string.
   */
  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  /**
   * Generate a UUID v4.
   * This is a convenience method that wraps crypto.randomUUID().
   */
  generateUUID(): string {
    return crypto.randomUUID();
  }
}
