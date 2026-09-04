import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { PaymentMethod } from '../../domain/entities/payment.entity';
import { PixChargeObject, PixChargeStatus } from '../../domain/entities/pix-charge.entity';
import { WithdrawalObject, WithdrawalStatus } from '../../domain/entities/withdrawal.entity';
import { Environment } from '../../domain/value-objects/environment.vo';
import { PublicEventType } from '../../domain/constants/event-catalog';
import { PaymentWithAttemptContext } from './payment-attempt-context.service';
import { PaymentLinkEventData } from './payment-link-event.service';

/**
 * Exemplos de `data` por tipo de evento, usados para gerar `docs/EVENTS.md`.
 *
 * Sao literais **tipados**, de proposito: se `PaymentObject`,
 * `PaymentLinkEventData` ou `WithdrawalObject` ganharem, perderem ou
 * renomearem um campo, o build quebra aqui e o exemplo tem que ser corrigido
 * junto. Um exemplo escrito a mao em Markdown apodreceria em silencio, que e
 * exatamente o problema que este catalogo existe para resolver.
 *
 * Ids e datas sao fixos para o doc gerado ser estavel entre execucoes.
 */

const EXAMPLE_STORE_ID = 'sto_2f8a91c4';
const EXAMPLE_CHARGE_ID = 'pch_4b1d77e0';
const EXAMPLE_PAYMENT_ID = 'pay_9c3e51ab';
const EXAMPLE_LINK_ID = 'lnk_7d20f6c1';
const EXAMPLE_WITHDRAWAL_ID = 'wdl_1a5c8e93';

const createdAt = new Date('2026-05-15T12:00:00.000Z');
const expiresAt = new Date('2026-05-15T12:30:00.000Z');
const paidAt = new Date('2026-05-15T12:04:12.000Z');

const pixCharge: PixChargeObject = {
  id: EXAMPLE_CHARGE_ID,
  storeId: EXAMPLE_STORE_ID,
  amount: 12990,
  currency: 'BRL',
  status: PixChargeStatus.OPEN,
  pixQrCode: 'data:image/png;base64,<qr omitido no exemplo>',
  pixCopyPaste: '00020126580014BR.GOV.BCB.PIX...',
  pixTxId: 'HPL9c3e51ab',
  expiresAt,
  createdAt,
  updatedAt: createdAt,
};

const basePayment: PaymentWithAttemptContext = {
  id: EXAMPLE_PAYMENT_ID,
  storeId: EXAMPLE_STORE_ID,
  customerId: 'cus_6e40b2df',
  pixChargeId: EXAMPLE_CHARGE_ID,
  amount: 12990,
  fee: 379,
  netAmount: 12611,
  currency: 'BRL',
  description: 'Camiseta Hockpay P',
  payerName: 'Ana Ribeiro',
  payerDocument: '529.982.247-25',
  payerEmail: 'ana@example.com',
  status: PaymentStatus.PENDING,
  environment: Environment.TEST,
  paymentMethod: PaymentMethod.PIX,
  totalRefunded: 0,
  pixCharge,
  expiresAt,
  createdAt,
  updatedAt: createdAt,
  attemptNumber: 1,
  attemptCount: 1,
  isLatestAttempt: true,
};

const confirmedPayment: PaymentWithAttemptContext = {
  ...basePayment,
  status: PaymentStatus.CONFIRMED,
  paidAt,
  updatedAt: paidAt,
  pixCharge: { ...pixCharge, status: PixChargeStatus.PAID, updatedAt: paidAt },
};

const linkData: PaymentLinkEventData = {
  id: EXAMPLE_LINK_ID,
  status: 'ACTIVE',
  amount: 12990,
  currency: 'BRL',
  environment: Environment.TEST,
  title: 'Camiseta Hockpay',
  description: 'Tamanho P, entrega em 5 dias uteis',
  internal_reference: 'pedido-4471',
  checkout_url: 'https://checkout.hockpay.dev/pay/9f2c1ba0e7d4',
  pix_charge_id: EXAMPLE_CHARGE_ID,
  items: [
    {
      id: 'pli_0b73d914',
      productId: 'prd_51ce8a20',
      productExternalId: 'camiseta-p',
      name: 'Camiseta Hockpay',
      description: 'Tamanho P',
      quantity: 1,
      unitPrice: 12990,
      totalPrice: 12990,
      imageUrl: 'https://cdn.example.com/camiseta-p.png',
      createdAt,
      updatedAt: createdAt,
    },
  ],
  payment_id: null,
  failed_payment_count: 0,
  expires_at: expiresAt,
  opened_at: null,
  cancelled_at: null,
  created_at: createdAt,
  updated_at: createdAt,
};

const withdrawal: WithdrawalObject = {
  id: EXAMPLE_WITHDRAWAL_ID,
  accountId: 'acc_3d91f7b2',
  bankAccountId: 'bnk_88a2c105',
  amount: 50000,
  fee: 350,
  netAmount: 49650,
  environment: Environment.TEST,
  status: WithdrawalStatus.PENDING,
  processingAttempts: 0,
  createdAt,
  updatedAt: createdAt,
};

/** `sanitizeWithdrawal` acrescenta o storeId ao objeto do saque. */
function withdrawalData(overrides: Partial<WithdrawalObject>): Record<string, unknown> {
  return { ...withdrawal, ...overrides, storeId: EXAMPLE_STORE_ID };
}

/**
 * `OutboxEvent.create` injeta `storeId` no payload de todo evento, entao os
 * exemplos precisam mostra-lo tambem.
 */
function withStoreId(data: object): Record<string, unknown> {
  return { ...data, storeId: EXAMPLE_STORE_ID };
}

export const EVENT_EXAMPLES: Record<PublicEventType, Record<string, unknown>> = {
  'payment.created': withStoreId(basePayment),
  'payment.confirmed': withStoreId(confirmedPayment),
  'payment.failed': withStoreId({
    ...basePayment,
    status: PaymentStatus.FAILED,
    failedReason: 'card_declined',
    attemptNumber: 2,
    attemptCount: 2,
  }),
  'payment.expired': withStoreId({
    ...basePayment,
    status: PaymentStatus.EXPIRED,
    pixCharge: { ...pixCharge, status: PixChargeStatus.EXPIRED },
  }),
  'payment.released': withStoreId({
    ...confirmedPayment,
    status: PaymentStatus.RELEASED,
    releasedAt: new Date('2026-05-17T12:04:12.000Z'),
  }),
  'payment.refunded': withStoreId({
    ...confirmedPayment,
    status: PaymentStatus.REFUNDED,
    totalRefunded: 12990,
  }),

  'payment_link.created': withStoreId(linkData),
  'payment_link.paid': withStoreId({
    ...linkData,
    status: 'PAID',
    payment_id: EXAMPLE_PAYMENT_ID,
    opened_at: new Date('2026-05-15T12:02:00.000Z'),
  }),
  'payment_link.expired': withStoreId({ ...linkData, status: 'EXPIRED' }),
  'payment_link.cancelled': withStoreId({
    ...linkData,
    status: 'CANCELLED',
    cancelled_at: new Date('2026-05-15T12:10:00.000Z'),
  }),

  'withdrawal.created': withdrawalData({}),
  'withdrawal.processing': withdrawalData({ status: WithdrawalStatus.PROCESSING }),
  'withdrawal.completed': withdrawalData({
    status: WithdrawalStatus.COMPLETED,
    paidAt: new Date('2026-05-15T12:20:00.000Z'),
    pixE2eId: 'E1234567820260515122000abcdef123',
  }),
  'withdrawal.failed': withdrawalData({
    status: WithdrawalStatus.FAILED,
    failedReason: 'bank_rejected',
  }),

  'webhook.test': {
    test: true,
    timestamp: 1778846400,
    message: 'This is a test webhook from Hockpay',
    configId: 'whc_2c9e4470',
  },
  'alert.test': {
    test: true,
    message: 'Teste de alerta Hockpay',
    alertConfigId: 'alc_5f13ba82',
    createdAt: createdAt.toISOString(),
  },
};
