/**
 * Result of generating a Pix QR Code.
 */
export interface PixQrCodeResult {
  /**
   * Base64-encoded QR code image.
   */
  qrCodeBase64: string;

  /**
   * EMV-compliant Pix copy-paste string (payload).
   */
  copyPaste: string;

  /**
   * Transaction ID (txId) - unique identifier for this Pix transaction.
   * Max 35 characters.
   */
  txId: string;
}

/**
 * Input for generating a Pix QR Code.
 */
export interface PixQrCodeInput {
  /**
   * Pix key of the recipient (merchant).
   */
  pixKey: string;

  /**
   * Amount in cents.
   */
  amountInCents: number;

  /**
   * Merchant name (max 25 characters).
   */
  merchantName: string;

  /**
   * Merchant city (max 15 characters).
   */
  merchantCity: string;

  /**
   * Transaction ID (max 35 characters).
   * If not provided, one will be generated.
   */
  txId?: string;
}

/**
 * Port: Pix QR Code Generator
 *
 * Interface for generating Pix QR codes following the EMV standard (BACEN specification).
 * This port is implemented in the infrastructure layer.
 */
export interface IPixQrCodeGeneratorPort {
  /**
   * Generate a Pix QR Code following EMV specifications.
   *
   * The generated QR code includes:
   * - Payload Format Indicator (ID 00)
   * - Merchant Account Info with GUI and Pix Key (ID 26)
   * - Transaction Currency (986 = BRL)
   * - Transaction Amount
   * - Merchant Name and City
   * - Additional Data with txId
   * - CRC16-CCITT checksum
   */
  generate(input: PixQrCodeInput): Promise<PixQrCodeResult>;
}
