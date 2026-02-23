import { Injectable } from '@nestjs/common';
import { TokenGeneratorService } from './token-generator.service';

/**
 * Service for generating and validating API Keys.
 *
 * API Keys follow the format: hk_{environment}_{32_random_hex_chars}
 * Example: hk_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
 *
 * The prefix (first 8 characters) is used for display purposes,
 * as the full key is never shown after creation.
 */
@Injectable()
export class ApiKeyGeneratorService {
  constructor(private readonly tokenGenerator: TokenGeneratorService) {}

  /**
   * Generate a new API Key.
   *
   * @param environment - The environment ('test' or 'live')
   * @returns A new API Key in the format hk_{environment}_{32_hex_chars}
   */
  generate(environment: 'test' | 'live'): string {
    const randomPart = this.tokenGenerator.generate(16); // 32 hex chars
    return `hk_${environment}_${randomPart}`;
  }

  /**
   * Extract the prefix from an API Key.
   * The prefix is the first 8 characters, used for display.
   *
   * @param key - The API Key
   * @returns The prefix (first 8 characters)
   */
  getPrefix(key: string): string {
    return key.substring(0, 8);
  }

  /**
   * Generate a SHA-256 hash of an API Key.
   * This is used for storing the key securely in the database.
   *
   * @param key - The API Key to hash
   * @returns The SHA-256 hash as a hexadecimal string
   */
  hash(key: string): string {
    return this.tokenGenerator.hash(key);
  }

  /**
   * Validate the format of an API Key.
   *
   * @param key - The API Key to validate
   * @returns true if the format is valid, false otherwise
   */
  isValidFormat(key: string): boolean {
    // Must start with hk_
    if (!key.startsWith('hk_')) {
      return false;
    }

    // Must have at least 3 parts: hk, environment, random part
    const parts = key.split('_');
    if (parts.length < 3) {
      return false;
    }

    // Environment must be 'test' or 'live'
    const env = parts[1];
    if (env !== 'test' && env !== 'live') {
      return false;
    }

    // Random part must be 32 hex characters (64 chars for 32 bytes)
    const randomPart = parts[2];
    if (!/^[a-f0-9]{32}$/.test(randomPart)) {
      return false;
    }

    return true;
  }

  /**
   * Extract the environment from an API Key.
   *
   * @param key - The API Key
   * @returns The environment ('test' or 'live')
   */
  extractEnvironment(key: string): 'test' | 'live' | null {
    const parts = key.split('_');
    if (parts.length < 2) {
      return null;
    }

    const env = parts[1];
    if (env === 'test' || env === 'live') {
      return env;
    }

    return null;
  }
}
