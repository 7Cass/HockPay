/**
 * Port interface for token generation.
 *
 * This port defines the contract for generating random tokens
 * (e.g., for refresh tokens, API keys, etc.).
 */
export interface ITokenGeneratorPort {
  /**
   * Generate a cryptographically secure random token.
   *
   * @param bytes - Number of random bytes to generate (default: 32)
   * @returns A hexadecimal string representing the random bytes
   */
  generate(bytes?: number): string;

  /**
   * Generate a URL-safe base64 encoded token.
   *
   * @param bytes - Number of random bytes to generate (default: 32)
   * @returns A URL-safe base64 string
   */
  generateBase64(bytes?: number): string;
}
