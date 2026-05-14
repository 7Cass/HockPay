import { describe, expect, it, vi } from 'vitest';
import {
  CheckoutSession,
  CustomerCollectionMode,
  Environment,
  Payment,
  PaymentNotFoundError,
  PaymentStatus,
  Receipt,
  ReceiptStatus,
  Refund,
  RefundStatus,
  Transaction,
  TransactionType,
  WebhookLog,
} from '../..';
import { GetPaymentTimelineUseCase } from './get-payment-timeline.use-case';

const dates = {
  created: new Date('2026-01-01T10:00:00.000Z'),
  checkout: new Date('2026-01-01T10:01:00.000Z'),
  paid: new Date('2026-01-01T10:02:00.000Z'),
  receipt: new Date('2026-01-01T10:03:00.000Z'),
  transaction: new Date('2026-01-01T10:04:00.000Z'),
  refund: new Date('2026-01-01T10:05:00.000Z'),
  webhook: new Date('2026-01-01T10:06:00.000Z'),
};

describe('GetPaymentTimelineUseCase', () => {
  it('returns payment detail with receipt, refund, transactions, webhook logs and timeline', async () => {
    const payment = makePayment({
      status: PaymentStatus.CONFIRMED,
      paidAt: dates.paid,
      updatedAt: dates.paid,
    });
    const receipt = makeReceipt(payment.id);
    const refund = makeRefund(payment.id);
    const checkoutSession = makeCheckoutSession(payment.id);
    const paymentTransaction = makeTransaction({
      id: 'tx-payment',
      referenceType: 'PAYMENT',
      referenceId: payment.id,
      createdAt: dates.transaction,
    });
    const refundTransaction = makeTransaction({
      id: 'tx-refund',
      referenceType: 'REFUND',
      referenceId: refund.id,
      createdAt: new Date('2026-01-01T10:05:30.000Z'),
    });
    const webhookLog = makeWebhookLog(payment.id);
    const { useCase, repos } = makeUseCase({
      payment,
      receipt,
      refunds: [refund],
      checkoutSession,
      transactionsByReference: new Map([
        [`PAYMENT:${payment.id}`, [paymentTransaction]],
        [`REFUND:${refund.id}`, [refundTransaction]],
      ]),
      webhookLogs: [webhookLog],
    });

    const result = await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
    });

    expect(repos.paymentRepository.findByIdAndStoreId).toHaveBeenCalledWith(
      payment.id,
      'store-1',
    );
    expect(result.payment.id).toBe(payment.id);
    expect(result.checkoutSession?.id).toBe(checkoutSession.id);
    expect(result.receipt?.id).toBe(receipt.id);
    expect(result.refunds).toHaveLength(1);
    expect(result.transactions.map((transaction) => transaction.id)).toEqual([
      'tx-payment',
      'tx-refund',
    ]);
    expect(result.webhookLogs).toHaveLength(1);
    expect(result.timeline.map((event) => event.type)).toEqual([
      'payment.created',
      'checkout.completed',
      'payment.confirmed',
      'receipt.issued',
      'transaction.recorded',
      'payment.refunded',
      'transaction.recorded',
      'webhook.delivered',
    ]);
  });

  it('returns null and empty arrays when related data does not exist', async () => {
    const payment = makePayment();
    const { useCase } = makeUseCase({ payment });

    const result = await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
    });

    expect(result.checkoutSession).toBeNull();
    expect(result.receipt).toBeNull();
    expect(result.refunds).toEqual([]);
    expect(result.transactions).toEqual([]);
    expect(result.webhookLogs).toEqual([]);
    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0]).toMatchObject({
      type: 'payment.created',
      entityId: payment.id,
    });
  });

  it('throws PaymentNotFoundError when payment does not belong to the store', async () => {
    const { useCase } = makeUseCase({ payment: null });

    await expect(
      useCase.execute({
        storeId: 'store-other',
        paymentId: 'payment-1',
      }),
    ).rejects.toBeInstanceOf(PaymentNotFoundError);
  });

  it('sorts timeline events by occurredAt ascending', async () => {
    const payment = makePayment({
      status: PaymentStatus.RELEASED,
      paidAt: new Date('2026-01-01T10:10:00.000Z'),
      releasedAt: new Date('2026-01-01T10:20:00.000Z'),
      updatedAt: new Date('2026-01-01T10:20:00.000Z'),
    });
    const earlyWebhook = WebhookLog.reconstitute({
      id: 'webhook-early',
      configId: 'config-1',
      paymentId: payment.id,
      eventType: 'payment.created',
      payload: {},
      attempt: 1,
      maxAttempts: 5,
      deliveredAt: new Date('2026-01-01T10:05:00.000Z'),
      createdAt: new Date('2026-01-01T10:04:00.000Z'),
    });
    const { useCase } = makeUseCase({
      payment,
      webhookLogs: [earlyWebhook],
    });

    const result = await useCase.execute({
      storeId: 'store-1',
      paymentId: payment.id,
    });

    expect(result.timeline.map((event) => event.type)).toEqual([
      'payment.created',
      'webhook.delivered',
      'payment.confirmed',
      'payment.released',
    ]);
  });
});

function makeUseCase(input: {
  payment: Payment | null;
  receipt?: Receipt | null;
  refunds?: Refund[];
  checkoutSession?: CheckoutSession | null;
  transactionsByReference?: Map<string, Transaction[]>;
  webhookLogs?: WebhookLog[];
}) {
  const transactionsByReference = input.transactionsByReference ?? new Map();
  const repos = {
    paymentRepository: {
      findByIdAndStoreId: vi.fn().mockResolvedValue(input.payment),
    },
    receiptRepository: {
      findByPaymentId: vi.fn().mockResolvedValue(input.receipt ?? null),
    },
    refundRepository: {
      findByPaymentId: vi.fn().mockResolvedValue(input.refunds ?? []),
    },
    checkoutSessionRepository: {
      findByPaymentId: vi.fn().mockResolvedValue(input.checkoutSession ?? null),
    },
    transactionRepository: {
      findByReference: vi.fn((referenceType: string, referenceId: string) =>
        Promise.resolve(
          transactionsByReference.get(`${referenceType}:${referenceId}`) ?? [],
        ),
      ),
    },
    webhookLogRepository: {
      findByPaymentId: vi.fn().mockResolvedValue(input.webhookLogs ?? []),
    },
  };

  return {
    repos,
    useCase: new GetPaymentTimelineUseCase(
      repos.paymentRepository as any,
      repos.receiptRepository as any,
      repos.refundRepository as any,
      repos.checkoutSessionRepository as any,
      repos.transactionRepository as any,
      repos.webhookLogRepository as any,
    ),
  };
}

function makePayment(overrides: Partial<Parameters<typeof Payment.reconstitute>[0]> = {}) {
  return Payment.reconstitute({
    id: 'payment-1',
    storeId: 'store-1',
    amount: 10000,
    fee: 200,
    netAmount: 9800,
    currency: 'BRL',
    description: 'Pedido #100',
    payerName: 'Ana Silva',
    payerDocument: '12345678909',
    payerEmail: 'ana@example.com',
    status: PaymentStatus.PENDING,
    environment: Environment.TEST,
    totalRefunded: 0,
    expiresAt: new Date('2026-01-01T11:00:00.000Z'),
    createdAt: dates.created,
    updatedAt: dates.created,
    ...overrides,
  });
}

function makeCheckoutSession(paymentId: string) {
  return CheckoutSession.create({
    id: 'checkout-1',
    storeId: 'store-1',
    amount: 10000,
    customerCollectionMode: CustomerCollectionMode.IDENTIFIED,
    paymentId,
    checkoutToken: 'checkout-token',
    status: 'COMPLETED',
    expiresAt: new Date('2026-01-01T11:00:00.000Z'),
    createdAt: dates.created,
    updatedAt: dates.checkout,
  });
}

function makeReceipt(paymentId: string) {
  return Receipt.reconstitute({
    id: 'receipt-1',
    receiptNumber: 'REC-20260101-0001',
    paymentId,
    storeId: 'store-1',
    payerName: 'Ana Silva',
    payerDocument: '12345678909',
    payerEmail: 'ana@example.com',
    payeeName: 'Hock Store',
    amount: 10000,
    fee: 200,
    netAmount: 9800,
    currency: 'BRL',
    status: ReceiptStatus.ISSUED,
    issuedAt: dates.receipt,
    createdAt: dates.receipt,
    updatedAt: dates.receipt,
  });
}

function makeRefund(paymentId: string) {
  return Refund.reconstitute({
    id: 'refund-1',
    paymentId,
    amount: 3000,
    feeRefunded: 60,
    reason: 'Solicitado pelo cliente',
    status: RefundStatus.PROCESSED,
    processedAt: dates.refund,
    createdAt: new Date('2026-01-01T10:04:30.000Z'),
  });
}

function makeTransaction(input: {
  id: string;
  referenceType: string;
  referenceId: string;
  createdAt: Date;
}) {
  return Transaction.reconstitute({
    id: input.id,
    accountId: 'account-1',
    type:
      input.referenceType === 'REFUND'
        ? TransactionType.REFUND_DEDUCTED
        : TransactionType.PAYMENT_RECEIVED,
    amount: 10000,
    fee: 200,
    netAmount: 9800,
    balanceAfter: 9800,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    description: input.referenceType,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

function makeWebhookLog(paymentId: string) {
  return WebhookLog.reconstitute({
    id: 'webhook-1',
    configId: 'config-1',
    paymentId,
    requestId: 'req-1',
    eventType: 'payment.confirmed',
    payload: {},
    responseStatus: 200,
    attempt: 1,
    maxAttempts: 5,
    deliveredAt: dates.webhook,
    createdAt: new Date('2026-01-01T10:05:45.000Z'),
  });
}
