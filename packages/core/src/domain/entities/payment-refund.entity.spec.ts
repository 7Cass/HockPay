import { describe, expect, it } from 'vitest';
import { Payment } from './payment.entity';
import { InvalidRefundAmountError } from '../errors/invalid-refund-amount.error';
import { InvalidRefundStatusError } from '../errors/invalid-refund-status.error';
import { Refund } from './refund.entity';

describe('Payment.addRefund and Refund.process', () => {
  it('rejects a non-positive refund through InvalidRefundAmountError', () => {
    const payment = Payment.create({
      storeId: 'store-1',
      amount: 1000,
      fee: 100,
      netAmount: 900,
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(() => payment.addRefund(0)).toThrow(InvalidRefundAmountError);
  });

  it('rejects a refund larger than the remaining amount', () => {
    const payment = Payment.create({
      storeId: 'store-1',
      amount: 1000,
      fee: 100,
      netAmount: 900,
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(() => payment.addRefund(1001)).toThrow(InvalidRefundAmountError);
  });

  it('rejects processing a refund that is not pending', () => {
    const refund = Refund.create({
      paymentId: 'payment-1',
      amount: 100,
    });
    refund.process();

    expect(() => refund.process()).toThrow(InvalidRefundStatusError);
  });
});
