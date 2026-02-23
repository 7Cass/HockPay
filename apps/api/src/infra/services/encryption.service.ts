import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { IEncryptionPort } from '@hockpay/core';

/**
 * Encryption service using AES-256-GCM.
 * Used to encrypt sensitive data like webhook secrets.
 */
@Injectable()
export class EncryptionService implements IEncryptionPort {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12; // 96 bits is recommended for GCM
  private readonly authTagLength = 16; // 128 bits
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');

    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    if (encryptionKey.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }

    this.key = Buffer.from(encryptionKey, 'hex');

    if (this.key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must decode to 32 bytes');
    }
  }

  /**
   * Encrypt a plaintext string.
   * @returns The encrypted string in format: iv:ciphertext:authTag (all hex)
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv, {
      authTagLength: this.authTagLength,
    });

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${ciphertext}:${authTag.toString('hex')}`;
  }

  /**
   * Decrypt an encrypted string.
   * @param ciphertext - The encrypted string in format: iv:ciphertext:authTag (all hex)
   * @returns The decrypted plaintext
   */
  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, encryptedData, authTagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv, {
      authTagLength: this.authTagLength,
    });

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
