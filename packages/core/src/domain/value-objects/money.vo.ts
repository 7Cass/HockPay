import { InvalidPaymentAmountError } from '../errors/invalid-payment-amount.error';

/**
 * Value Object: Money
 *
 * Represents a monetary value in cents to avoid floating-point precision issues.
 * All amounts are stored as integers (cents) and can be formatted for display.
 */
export class Money {
  private readonly _amountInCents: number;
  private readonly _currency: string;

  constructor(amountInCents: number, currency: string = 'BRL') {
    if (!Number.isInteger(amountInCents)) {
      throw new InvalidPaymentAmountError(
        'Amount must be an integer (cents)',
        amountInCents
      );
    }

    if (amountInCents <= 0) {
      throw new InvalidPaymentAmountError(
        'Amount must be greater than zero',
        amountInCents
      );
    }

    this._amountInCents = amountInCents;
    this._currency = currency;
  }

  /**
   * Gets the amount in cents.
   */
  get amountInCents(): number {
    return this._amountInCents;
  }

  /**
   * Gets the currency code (e.g., "BRL").
   */
  get currency(): string {
    return this._currency;
  }

  /**
   * Gets the amount in decimal format (e.g., 10000 cents → 100.00).
   */
  get decimalAmount(): number {
    return this._amountInCents / 100;
  }

  /**
   * Formats the amount as a string with currency symbol.
   * Example: "R$ 100,00" for BRL
   */
  get formatted(): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: this._currency,
    }).format(this.decimalAmount);
  }

  /**
   * Checks if two Money instances are equal.
   */
  equals(other: Money): boolean {
    return (
      this._amountInCents === other._amountInCents &&
      this._currency === other._currency
    );
  }

  /**
   * Adds another Money instance to this one.
   * Both must have the same currency.
   */
  add(other: Money): Money {
    if (this._currency !== other._currency) {
      throw new Error('Cannot add money with different currencies');
    }
    return new Money(this._amountInCents + other._amountInCents, this._currency);
  }

  /**
   * Subtracts another Money instance from this one.
   * Both must have the same currency.
   * Returns null if the result would be negative.
   */
  subtract(other: Money): Money | null {
    if (this._currency !== other._currency) {
      throw new Error('Cannot subtract money with different currencies');
    }
    const result = this._amountInCents - other._amountInCents;
    if (result < 0) {
      return null;
    }
    return new Money(result, this._currency);
  }

  /**
   * Creates a Money instance from a decimal value.
   * Example: fromDecimal(100.50, 'BRL') → Money with 10050 cents
   */
  static fromDecimal(decimalAmount: number, currency: string = 'BRL'): Money {
    const cents = Math.round(decimalAmount * 100);
    return new Money(cents, currency);
  }

  /**
   * Creates a Money instance from cents.
   * Example: fromCents(10050, 'BRL') → Money with 10050 cents
   */
  static fromCents(cents: number, currency: string = 'BRL'): Money {
    return new Money(cents, currency);
  }
}
