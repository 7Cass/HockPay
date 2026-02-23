/**
 * Port: HMAC Signer
 *
 * Interface for signing payloads with HMAC-SHA256.
 * This port is implemented in the infrastructure layer using crypto.
 */
export interface IHmacSignerPort {
  /**
   * Sign a payload with HMAC-SHA256.
   *
   * @param secret - The secret key
   * @param payload - The payload to sign
   * @param timestamp - Unix timestamp for the signature
   * @returns The signature in format "sha256=<hex>"
   */
  sign(secret: string, payload: Record<string, unknown>, timestamp: number): string;

  /**
   * Verify a signature.
   *
   * @param secret - The secret key
   * @param payload - The payload that was signed
   * @param timestamp - The timestamp used in the signature
   * @param signature - The signature to verify
   * @returns True if the signature is valid
   */
  verify(
    secret: string,
    payload: Record<string, unknown>,
    timestamp: number,
    signature: string,
  ): boolean;
}
