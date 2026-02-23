/**
 * Value Object: Money
 *
 * Representa valores monetários usando centavos para evitar problemas de precisão
 * com ponto flutuante. Segue o padrão Fowler Money pattern.
 */

export enum Currency {
  BRL = 'BRL',
  USD = 'USD',
  EUR = 'EUR',
}

export class Money {
  private readonly _amount: number; // Valor em centavos
  private readonly _currency: Currency;

  constructor(amountInCents: number, currency: Currency = Currency.BRL) {
    if (amountInCents < 0) {
      throw new Error('Money amount cannot be negative');
    }
    if (!Number.isInteger(amountInCents)) {
      throw new Error('Money amount must be in cents (integer)');
    }
    this._amount = amountInCents;
    this._currency = currency;
  }

  get amountInCents(): number {
    return this._amount;
  }

  get currency(): Currency {
    return this._currency;
  }

  /**
   * Retorna o valor em reais (dividido por 100)
   */
  get toDecimal(): number {
    return this._amount / 100;
  }

  /**
   * Cria Money a partir de valor decimal
   */
  static fromDecimal(amount: number, currency: Currency = Currency.BRL): Money {
    const cents = Math.round(amount * 100);
    return new Money(cents, currency);
  }

  /**
   * Soma dois valores Money
   */
  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  /**
   * Subtrai dois valores Money
   */
  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this._amount - other._amount;
    if (result < 0) {
      throw new Error('Subtraction would result in negative amount');
    }
    return new Money(result, this._currency);
  }

  /**
   * Multiplica o valor por um fator
   */
  multiply(factor: number): Money {
    if (factor < 0) {
      throw new Error('Multiply factor cannot be negative');
    }
    return new Money(Math.round(this._amount * factor), this._currency);
  }

  /**
   * Calcula porcentagem do valor
   */
  percentage(percent: number): Money {
    if (percent < 0) {
      throw new Error('Percentage cannot be negative');
    }
    return new Money(Math.round(this._amount * (percent / 100)), this._currency);
  }

  /**
   * Retorna o valor formatado como string
   */
  format(): string {
    const decimalValue = this.toDecimal;
    const formatted = decimalValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: this._currency,
    });
    return formatted;
  }

  /**
   * Compara dois valores Money
   */
  equals(other: Money): boolean {
    return this._amount === other._amount && this._currency === other._currency;
  }

  /**
   * Verifica se é maior que outro valor
   */
  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount > other._amount;
  }

  /**
   * Verifica se é menor que outro valor
   */
  lessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount < other._amount;
  }

  /**
   * Verifica se é zero
   */
  isZero(): boolean {
    return this._amount === 0;
  }

  /**
   * Verifica se é positivo
   */
  isPositive(): boolean {
    return this._amount > 0;
  }

  /**
   * Divide o valor em duas partes (base e fee)
   * @paramPercent - Porcentagem da taxa (ex: 1.5 para 1.5%)
   * @paramFixed - Valor fixo da taxa em centavos
   */
  calculateFee(feePercent: number, feeFixed: number): { total: Money; fee: Money; net: Money } {
    const fee = this.percentage(feePercent).add(new Money(feeFixed, this._currency));
    const net = this.subtract(fee);
    return { total: this, fee, net };
  }

  private assertSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error(`Cannot operate with different currencies: ${this._currency} and ${other._currency}`);
    }
  }

  toJSON() {
    return {
      amountInCents: this._amount,
      decimal: this.toDecimal,
      currency: this._currency,
      formatted: this.format(),
    };
  }
}
