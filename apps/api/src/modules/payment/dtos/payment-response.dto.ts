import { PaymentStatus, PaymentMethod } from '@hockpay/core';
import type {
  CheckoutSessionObject,
  PaymentTimelineEvent,
  ReceiptObject,
  RefundObject,
  TransactionObject,
} from '@hockpay/core';
import type { WebhookLogDto } from '../../webhook/dtos/webhook-response.dto';

/**
 * Response DTO for payment data.
 */
export class PaymentResponseDto {
  id: string;
  storeId: string;
  customerId?: string;
  externalId?: string;
  paymentLinkId?: string;
  paymentOrigin?: string;
  attemptNumber?: number;
  attemptCount?: number;
  isLatestAttempt?: boolean;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  description?: string;
  payerName?: string;
  payerDocument?: string;
  payerEmail?: string;
  status: PaymentStatus;
  environment: string;
  paymentMethod: PaymentMethod;
  paymentDetails?: Record<string, unknown>;
  acquirerId?: string;
  totalRefunded: number;
  pixChargeId?: string;
  pixCharge?: {
    id: string;
    status: string;
    pixQrCode: string;
    pixCopyPaste: string;
    pixTxId: string;
    expiresAt?: Date | null;
  };
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

/**
 * Response DTO for payment timeline endpoint.
 */
export class GetPaymentTimelineResponseDto {
  payment: PaymentResponseDto;
  relatedAttempts: PaymentResponseDto[];
  checkoutSession?: CheckoutSessionObject | null;
  receipt?: ReceiptObject | null;
  refunds: RefundObject[];
  transactions: TransactionObject[];
  webhookLogs: WebhookLogDto[];
  timeline: PaymentTimelineEvent[];
}
