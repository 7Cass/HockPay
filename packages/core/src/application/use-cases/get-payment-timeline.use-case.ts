import {
  CheckoutSessionObject,
} from '../../domain/entities/checkout-session.entity';
import { PaymentObject } from '../../domain/entities/payment.entity';
import { ReceiptObject } from '../../domain/entities/receipt.entity';
import { RefundObject } from '../../domain/entities/refund.entity';
import { TransactionObject } from '../../domain/entities/transaction.entity';
import {
  WebhookDeliveryStatus,
  WebhookLogObject,
} from '../../domain/entities/webhook-log.entity';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { PaymentNotFoundError } from '../../domain/errors/payment-not-found.error';
import { ICheckoutSessionRepository } from '../../domain/repositories/checkout-session.repository.interface';
import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import { IReceiptRepository } from '../../domain/repositories/receipt.repository.interface';
import { IRefundRepository } from '../../domain/repositories/refund.repository.interface';
import { ITransactionRepository } from '../../domain/repositories/transaction.repository.interface';
import { IWebhookLogRepository } from '../../domain/repositories/webhook-log.repository.interface';
import {
  enrichPaymentAttempt,
  enrichPaymentAttempts,
} from '../services/payment-attempt-context.service';

export type PaymentTimelineEventType =
  | 'payment.created'
  | 'checkout.completed'
  | 'payment.confirmed'
  | 'payment.expired'
  | 'payment.failed'
  | 'payment.released'
  | 'payment.refunded'
  | 'receipt.issued'
  | 'transaction.recorded'
  | 'webhook.delivered'
  | 'webhook.failed'
  | 'webhook.pending';

export type PaymentTimelineEventStatus =
  | 'completed'
  | 'pending'
  | 'failed'
  | 'neutral';

export interface PaymentTimelineEvent {
  id: string;
  type: PaymentTimelineEventType;
  status: PaymentTimelineEventStatus;
  title: string;
  description?: string;
  occurredAt: Date;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface IGetPaymentTimelineInput {
  storeId: string;
  paymentId: string;
}

export interface IGetPaymentTimelineOutput {
  payment: PaymentObject;
  relatedAttempts: PaymentObject[];
  checkoutSession?: CheckoutSessionObject | null;
  receipt?: ReceiptObject | null;
  refunds: RefundObject[];
  transactions: TransactionObject[];
  webhookLogs: WebhookLogObject[];
  timeline: PaymentTimelineEvent[];
}

export class GetPaymentTimelineUseCase {
  constructor(
    private readonly paymentRepository: IPaymentRepository,
    private readonly receiptRepository: IReceiptRepository,
    private readonly refundRepository: IRefundRepository,
    private readonly checkoutSessionRepository: ICheckoutSessionRepository,
    private readonly transactionRepository: ITransactionRepository,
    private readonly webhookLogRepository: IWebhookLogRepository,
  ) {}

  async execute(
    input: IGetPaymentTimelineInput,
  ): Promise<IGetPaymentTimelineOutput> {
    const payment = await this.paymentRepository.findByIdAndStoreId(
      input.paymentId,
      input.storeId,
    );

    if (!payment) {
      throw new PaymentNotFoundError(input.paymentId);
    }

    const [
      receipt,
      refunds,
      checkoutSession,
      paymentTransactions,
      webhookLogs,
      relatedPayments,
    ] =
      await Promise.all([
        this.receiptRepository.findByPaymentId(payment.id),
        this.refundRepository.findByPaymentId(payment.id),
        this.checkoutSessionRepository.findByPaymentId(payment.id),
        this.transactionRepository.findByReference('PAYMENT', payment.id),
        this.webhookLogRepository.findByPaymentId(payment.id),
        payment.pixChargeId
          ? this.paymentRepository.findByPixChargeIdAndStoreId(
              payment.pixChargeId,
              input.storeId,
            )
          : Promise.resolve([payment]),
      ]);

    const refundTransactionGroups = await Promise.all(
      refunds.map((refund) =>
        this.transactionRepository.findByReference('REFUND', refund.id),
      ),
    );
    const transactions = [
      ...paymentTransactions,
      ...refundTransactionGroups.flat(),
    ];

    const relatedAttemptObjects = enrichPaymentAttempts(
      relatedPayments.map((relatedPayment) => relatedPayment.toObject()),
    );
    const paymentObject = enrichPaymentAttempt(
      payment.toObject(),
      relatedAttemptObjects,
    );
    const receiptObject = receipt?.toObject() ?? null;
    const refundObjects = refunds.map((refund) => refund.toObject());
    const checkoutSessionObject = checkoutSession?.toObject() ?? null;
    const transactionObjects = transactions.map((transaction) =>
      transaction.toObject(),
    );
    const webhookLogObjects = webhookLogs.map((log) => log.toObject());

    return {
      payment: paymentObject,
      relatedAttempts: relatedAttemptObjects,
      checkoutSession: checkoutSessionObject,
      receipt: receiptObject,
      refunds: refundObjects,
      transactions: transactionObjects,
      webhookLogs: webhookLogObjects,
      timeline: this.buildTimeline({
        payment: paymentObject,
        checkoutSession: checkoutSessionObject,
        receipt: receiptObject,
        refunds: refundObjects,
        transactions: transactionObjects,
        webhookLogs: webhookLogObjects,
      }),
    };
  }

  private buildTimeline(input: {
    payment: PaymentObject;
    checkoutSession: CheckoutSessionObject | null;
    receipt: ReceiptObject | null;
    refunds: RefundObject[];
    transactions: TransactionObject[];
    webhookLogs: WebhookLogObject[];
  }): PaymentTimelineEvent[] {
    const events: PaymentTimelineEvent[] = [
      {
        id: `payment.created:${input.payment.id}`,
        type: 'payment.created',
        status: 'completed',
        title: 'Pagamento criado',
        description: input.payment.description,
        occurredAt: input.payment.createdAt,
        entityId: input.payment.id,
        metadata: {
          amount: input.payment.amount,
          currency: input.payment.currency,
          externalId: input.payment.externalId,
        },
      },
    ];

    if (input.checkoutSession?.status === 'COMPLETED') {
      events.push({
        id: `checkout.completed:${input.checkoutSession.id}`,
        type: 'checkout.completed',
        status: 'completed',
        title: 'Checkout concluido',
        description: input.checkoutSession.description ?? undefined,
        occurredAt: input.checkoutSession.updatedAt,
        entityId: input.checkoutSession.id,
        metadata: {
          checkoutToken: input.checkoutSession.checkoutToken,
          amount: input.checkoutSession.amount,
        },
      });
    }

    if (input.payment.paidAt) {
      events.push({
        id: `payment.confirmed:${input.payment.id}`,
        type: 'payment.confirmed',
        status: 'completed',
        title: 'Pagamento confirmado',
        occurredAt: input.payment.paidAt,
        entityId: input.payment.id,
        metadata: {
          pixTxId: input.payment.pixCharge?.pixTxId,
          netAmount: input.payment.netAmount,
        },
      });
    }

    if (input.payment.status === PaymentStatus.EXPIRED) {
      events.push({
        id: `payment.expired:${input.payment.id}`,
        type: 'payment.expired',
        status: 'failed',
        title: 'Pagamento expirado',
        occurredAt: input.payment.updatedAt,
        entityId: input.payment.id,
      });
    }

    if (input.payment.status === PaymentStatus.FAILED) {
      events.push({
        id: `payment.failed:${input.payment.id}`,
        type: 'payment.failed',
        status: 'failed',
        title: 'Pagamento falhou',
        description: input.payment.failedReason,
        occurredAt: input.payment.updatedAt,
        entityId: input.payment.id,
      });
    }

    if (input.payment.releasedAt) {
      events.push({
        id: `payment.released:${input.payment.id}`,
        type: 'payment.released',
        status: 'completed',
        title: 'Saldo liberado',
        occurredAt: input.payment.releasedAt,
        entityId: input.payment.id,
        metadata: {
          netAmount: input.payment.netAmount,
        },
      });
    }

    for (const refund of input.refunds) {
      events.push({
        id: `payment.refunded:${refund.id}`,
        type: 'payment.refunded',
        status: this.mapRefundStatus(refund.status),
        title: 'Estorno registrado',
        description: refund.reason,
        occurredAt: refund.processedAt ?? refund.createdAt,
        entityId: refund.id,
        metadata: {
          amount: refund.amount,
          feeRefunded: refund.feeRefunded,
          refundStatus: refund.status,
        },
      });
    }

    if (input.receipt) {
      events.push({
        id: `receipt.issued:${input.receipt.id}`,
        type: 'receipt.issued',
        status: 'completed',
        title: 'Comprovante emitido',
        description: input.receipt.receiptNumber,
        occurredAt: input.receipt.issuedAt,
        entityId: input.receipt.id,
        metadata: {
          receiptNumber: input.receipt.receiptNumber,
          amount: input.receipt.amount,
        },
      });
    }

    for (const transaction of input.transactions) {
      events.push({
        id: `transaction.recorded:${transaction.id}`,
        type: 'transaction.recorded',
        status: 'neutral',
        title: 'Lancamento financeiro',
        description: transaction.description,
        occurredAt: transaction.createdAt,
        entityId: transaction.id,
        metadata: {
          type: transaction.type,
          amount: transaction.amount,
          fee: transaction.fee,
          netAmount: transaction.netAmount,
          referenceType: transaction.referenceType,
          referenceId: transaction.referenceId,
        },
      });
    }

    for (const log of input.webhookLogs) {
      const webhookStatus = this.mapWebhookStatus(log);
      events.push({
        id: `${webhookStatus.type}:${log.id}`,
        type: webhookStatus.type,
        status: webhookStatus.status,
        title: webhookStatus.title,
        description: log.eventType,
        occurredAt: log.deliveredAt ?? log.createdAt,
        entityId: log.id,
        metadata: {
          deliveryId: log.id,
          requestId: log.requestId,
          deliveryStatus: log.status,
          responseStatus: log.responseStatus,
          attempt: log.attempt,
          maxAttempts: log.maxAttempts,
          failedAt: log.failedAt,
          lastError: log.lastError,
        },
      });
    }

    return events.sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
    );
  }

  private mapRefundStatus(status: RefundObject['status']): PaymentTimelineEventStatus {
    if (status === 'FAILED') return 'failed';
    if (status === 'PENDING') return 'pending';
    return 'completed';
  }

  private mapWebhookStatus(log: WebhookLogObject): {
    type: 'webhook.delivered' | 'webhook.failed' | 'webhook.pending';
    status: PaymentTimelineEventStatus;
    title: string;
  } {
    if (log.status === WebhookDeliveryStatus.DELIVERED || log.deliveredAt) {
      return {
        type: 'webhook.delivered',
        status: 'completed',
        title: 'Webhook entregue',
      };
    }

    if (log.status === WebhookDeliveryStatus.FAILED_FINAL) {
      return {
        type: 'webhook.failed',
        status: 'failed',
        title: 'Webhook falhou definitivamente',
      };
    }

    if (log.status === WebhookDeliveryStatus.FAILED_RETRYABLE) {
      return {
        type: 'webhook.failed',
        status: 'pending',
        title: 'Webhook com retry pendente',
      };
    }

    if (log.responseStatus || log.attempt > 1) {
      return {
        type: 'webhook.failed',
        status: 'failed',
        title: 'Webhook falhou',
      };
    }

    return {
      type: 'webhook.pending',
      status: 'pending',
      title: 'Webhook pendente',
    };
  }
}
