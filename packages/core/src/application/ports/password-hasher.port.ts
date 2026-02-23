/**
 * Port interface for password hashing.
 *
 * This port defines the contract for password hashing operations.
 * The infrastructure layer should provide an implementation (e.g., argon2, bcrypt).
 */
export interface IPasswordHasherPort {
  /**
   * Hash a plain text password.
   */
  hash(password: string): Promise<string>;

  /**
   * Verify a plain text password against a hash.
   */
  verify(password: string, hash: string): Promise<boolean>;
}
