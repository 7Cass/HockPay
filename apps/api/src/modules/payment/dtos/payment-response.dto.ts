import { PaymentStatus, PaymentMethod } from '@hockpay/core';

/**
 * Response DTO for payment data.
 */
export class PaymentResponseDto {
  id: string;
  storeId: string;
  customerId: string;
  externalId?: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  description?: string;
  status: PaymentStatus;
  environment: string;
  paymentMethod: PaymentMethod;
  paymentDetails?: Record<string, unknown>;
  acquirerId?: string;
  totalRefunded: number;
  pixQrCode?: string;
  pixCopyPaste?: string;
  pixTxId?: string;
  checkoutUrl?: string;
  expiresAt: Date;
  paidAt?: Date;
  releasedAt?: Date;
  failedReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Response DTO for create payment endpoint.
 */
export class CreatePaymentResponseDto {
  payment: PaymentResponseDto;
  customerCreated: boolean;
}

/**
 * Response DTO for get payment endpoint.
 */
export class GetPaymentResponseDto {
  payment: PaymentResponseDto;
}
