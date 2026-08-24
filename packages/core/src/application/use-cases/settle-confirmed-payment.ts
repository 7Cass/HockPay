import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { Payment, PaymentObject } from '../../domain/entities/payment.entity';
import { PixCharge } from '../../domain/entities/pix-charge.entity';
import { Receipt } from '../../domain/entities/receipt.entity';
import { Transaction, TransactionType } from '../../domain/entities/transaction.entity';
import { AccountNotFoundError } from '../../domain/errors/account-not-found.error';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';
import { ITransactedRepositories } from '../../domain/repositories/unit-of-work.interface';
import { enrichPaymentAttempt } from '../services/payment-attempt-context.service';
import { buildReceiptNumber } from './receipt-number';

export interface SettleConfirmedPaymentInput {
  payment: Payment;
  pixCharge?: PixCharge | null;
  storeId: string;
  requestId?: string;
}

export async function settleConfirmedPayment(
  repos: ITransactedRepositories,
  input: SettleConfirmedPaymentInput,
): Promise<PaymentObject> {
  const account = await repos.accountRepository.findByStoreIdForUpdate(input.storeId);
  if (!account) {
    throw new AccountNotFoundError(input.storeId);
  }

  account.addToPending(input.payment.netAmount);
  await repos.accountRepository.update(account);

  if (input.pixCharge) {
    input.pixCharge.markPaid();
    await repos.pixChargeRepository.update(input.pixCharge);
  }

  await repos.paymentRepository.update(input.payment);

  const transaction = Transaction.create({
    accountId: account.id,
    type: TransactionType.PAYMENT_RECEIVED,
    amount: input.payment.amount,
    fee: input.payment.fee,
    netAmount: input.payment.netAmount,
    balanceAfter: account.totalBalance,
    referenceType: 'PAYMENT',
    referenceId: input.payment.id,
    description: `Pagamento recebido (#${input.payment.id.split('-')[0]})`,
  });
  await repos.transactionRepository.save(transaction);

  const store = await repos.storeRepository.findById(input.storeId);
  if (!store) {
    throw new StoreNotFoundError(input.storeId);
  }

  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const sequence = await repos.receiptRepository.incrementCounter(input.storeId, dateStr);
  const receiptNumber = buildReceiptNumber(input.storeId, dateStr, sequence);

  const customer = input.payment.customerId
    ? await repos.customerRepository.findById(input.payment.customerId)
    : null;

  const receipt = Receipt.create({
    receiptNumber,
    paymentId: input.payment.id,
    customerId: input.payment.customerId,
    storeId: input.storeId,
    payerName: input.payment.payerName ?? customer?.name,
    payerDocument: input.payment.payerDocument ?? customer?.document.value,
    payerEmail: input.payment.payerEmail ?? customer?.email,
    payeeName: store.name,
    payeeDocument: undefined,
    amount: input.payment.amount,
    fee: input.payment.fee,
    netAmount: input.payment.netAmount,
    currency: input.payment.currency,
    description: input.payment.description,
  });
  await repos.receiptRepository.save(receipt);

  const relatedAttempts = input.payment.pixChargeId
    ? await repos.paymentRepository.findByPixChargeIdAndStoreId(
        input.payment.pixChargeId,
        input.storeId,
      )
    : [input.payment];
  const paymentPayload = enrichPaymentAttempt(
    {
      ...input.payment.toObject(),
      pixCharge: input.pixCharge?.toObject() ?? input.payment.pixCharge,
    },
    relatedAttempts.map((attempt) =>
      attempt.id === input.payment.id
        ? {
            ...input.payment.toObject(),
            pixCharge: input.pixCharge?.toObject() ?? input.payment.pixCharge,
          }
        : attempt.toObject(),
    ),
  );

  const outboxEvent = OutboxEvent.create({
    aggregateType: 'Payment',
    aggregateId: input.payment.id,
    eventType: 'payment.confirmed',
    requestId: input.requestId,
    storeId: input.payment.storeId,
    payload: paymentPayload as unknown as Record<string, unknown>,
  });
  await repos.outboxWriter.save(outboxEvent);

  return paymentPayload;
}
