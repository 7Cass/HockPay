import { describe, expect, it } from 'vitest';
import { FeePolicy } from './fee-policy.service';
import { InvalidPaymentAmountError } from '../../domain/errors/invalid-payment-amount.error';

describe('FeePolicy', () => {
  const policy = new FeePolicy();

  it('calculates percent plus fixed fee', () => {
    expect(
      policy.calculate({
        amountInCents: 10_000,
        feePercent: 1.5,
        feeFixed: 15,
      }),
    ).toEqual({
      percentFeeInCents: 150,
      fixedFeeInCents: 15,
      feeInCents: 165,
      netAmountInCents: 9835,
    });
  });

  it('rejects a fee that would zero or invert the net amount', () => {
    expect(() =>
      policy.calculate({
        amountInCents: 100,
        feePercent: 50,
        feeFixed: 80,
      }),
    ).toThrow(InvalidPaymentAmountError);
  });
});
