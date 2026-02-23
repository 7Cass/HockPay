/**
 * Port: Encryption Service
 *
 * Interface for encrypting and decrypting sensitive data.
 * This port is implemented in the infrastructure layer using crypto.
 */
export interface IEncryptionPort {
  /**
   * Encrypt a plaintext string.
   *
   * @param plaintext - The string to encrypt
   * @returns The encrypted string in format: iv:ciphertext:authTag (all hex)
   */
  encrypt(plaintext: string): string;

  /**
   * Decrypt an encrypted string.
   *
   * @param ciphertext - The encrypted string in format: iv:ciphertext:authTag (all hex)
   * @returns The decrypted plaintext
   */
  decrypt(ciphertext: string): string;
}
