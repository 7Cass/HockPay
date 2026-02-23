import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { IHmacSignerPort } from '@hockpay/core';

/**
 * Implementation of IHmacSignerPort using Node.js crypto module.
 */
@Injectable()
export class HmacSignerService implements IHmacSignerPort {
  /**
   * Sign a payload with HMAC-SHA256.
   */
  sign(secret: string, payload: Record<string, unknown>, timestamp: number): string {
    const payloadString = JSON.stringify(payload);
    const signatureBase = `${secret}${timestamp}${payloadString}`;

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(signatureBase);
    const hash = hmac.digest('hex');

    return `sha256=${hash}`;
  }

  /**
   * Verify a signature.
   */
  verify(
    secret: string,
    payload: Record<string, unknown>,
    timestamp: number,
    signature: string,
  ): boolean {
    const expectedSignature = this.sign(secret, payload, timestamp);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }
}
