import { Injectable } from '@nestjs/common';
import {
  IPixQrCodeGeneratorPort,
  PixQrCodeInput,
  PixQrCodeResult,
} from '@hockpay/core';
import * as QRCode from 'qrcode';

/**
 * Service for generating Pix QR Codes following the EMV standard (BACEN specification).
 *
 * The generated QR code payload follows the EMV-QR specification:
 * - Payload Format Indicator (ID 00)
 * - Merchant Account Info (ID 26) with GUI (ID 00) and Pix Key (ID 01)
 * - Transaction Currency (ID 53) - 986 for BRL
 * - Transaction Amount (ID 54)
 * - Merchant Name (ID 59)
 * - Merchant City (ID 60)
 * - Additional Data (ID 62) with txId (ID 05)
 * - CRC16-CCITT checksum (ID 63)
 */
@Injectable()
export class PixQrCodeGeneratorService implements IPixQrCodeGeneratorPort {
  /**
   * BACEN GUI for Pix (fixed value)
   */
  private static readonly PIX_GUI = 'BR.GOV.BCB.PIX';

  /**
   * Transaction Currency for BRL (ISO 4217 numeric code)
   */
  private static readonly CURRENCY_BRL = '986';

  /**
   * Country code for Brazil
   */
  private static readonly COUNTRY_CODE = 'BR';

  async generate(input: PixQrCodeInput): Promise<PixQrCodeResult> {
    const txId = input.txId ?? this.generateTxId();

    // Build the EMV payload
    const payload = this.buildPayload({
      pixKey: input.pixKey,
      amountInCents: input.amountInCents,
      merchantName: input.merchantName,
      merchantCity: input.merchantCity,
      txId,
    });

    // Generate QR code as base64 image
    const qrCodeBase64 = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
    });

    return {
      qrCodeBase64,
      copyPaste: payload,
      txId,
    };
  }

  /**
   * Build the EMV-compliant Pix payload string.
   */
  private buildPayload(params: {
    pixKey: string;
    amountInCents: number;
    merchantName: string;
    merchantCity: string;
    txId: string;
  }): string {
    const { pixKey, amountInCents, merchantName, merchantCity, txId } = params;

    // Format amount as decimal with 2 decimal places
    const amount = (amountInCents / 100).toFixed(2);

    // Build Merchant Account Info (ID 26)
    const merchantAccountInfo = this.buildField(
      '26',
      this.buildField('00', PixQrCodeGeneratorService.PIX_GUI) +
        this.buildField('01', pixKey),
    );

    // Build Additional Data Field Template (ID 62)
    const additionalData = this.buildField('62', this.buildField('05', txId));

    // Build payload without CRC
    const payloadWithoutCrc =
      this.buildField('00', '01') + // Payload Format Indicator
      this.buildField('01', '11') + // Point of Initiation Method (11 = dynamic QR)
      merchantAccountInfo +
      this.buildField('52', '0000') + // Merchant Category Code
      this.buildField('53', PixQrCodeGeneratorService.CURRENCY_BRL) + // Transaction Currency
      this.buildField('54', amount) + // Transaction Amount
      this.buildField('58', PixQrCodeGeneratorService.COUNTRY_CODE) + // Country Code
      this.buildField('59', this.sanitize(merchantName, 25)) + // Merchant Name
      this.buildField('60', this.sanitize(merchantCity, 15)) + // Merchant City
      additionalData +
      '6304'; // CRC placeholder

    // Calculate CRC16-CCITT
    const crc = this.calculateCrc16(payloadWithoutCrc);

    return payloadWithoutCrc + crc;
  }

  /**
   * Build an EMV field with ID and value.
   * Format: ID + LENGTH + VALUE
   */
  private buildField(id: string, value: string): string {
    const length = value.length.toString().padStart(2, '0');
    return id + length + value;
  }

  /**
   * Sanitize a string to meet length requirements.
   * Removes special characters and truncates to max length.
   */
  private sanitize(value: string, maxLength: number): string {
    // Remove non-ASCII characters and trim
    const sanitized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
      .trim()
      .toUpperCase();

    return sanitized.substring(0, maxLength);
  }

  /**
   * Calculate CRC16-CCITT checksum.
   * Polynomial: 0x1021, Initial value: 0xFFFF
   */
  private calculateCrc16(str: string): string {
    let crc = 0xffff;
    const polynomial = 0x1021;

    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ polynomial;
        } else {
          crc <<= 1;
        }
        crc &= 0xffff;
      }
    }

    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  /**
   * Generate a unique transaction ID.
   * Format: HP + timestamp (base36) + random (8 chars)
   */
  private generateTxId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomUUID().split('-')[0].toUpperCase();
    return `HP${timestamp}${random}`.substring(0, 35);
  }
}
