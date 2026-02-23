import { Money, Currency } from '../value-objects';

/**
 * Entidade de Domínio: Account
 *
 * Representa a conta financeira de uma store.
 */
export class Account {
  private _id: string;
  private _storeId: string;
  private _available: Money;
  private _pending: Money;
  private _blocked: Money;
  private _currency: string;
  private _updatedAt: Date;

  private constructor(props: {
    id: string;
    storeId: string;
    available: Money;
    pending: Money;
    blocked: Money;
    currency: string;
    updatedAt: Date;
  }) {
    this._id = props.id;
    this._storeId = props.storeId;
    this._available = props.available;
    this._pending = props.pending;
    this._blocked = props.blocked;
    this._currency = props.currency;
    this._updatedAt = props.updatedAt;
  }

  // Getters
  get id(): string { return this._id; }
  get storeId(): string { return this._storeId; }
  get available(): Money { return this._available; }
  get pending(): Money { return this._pending; }
  get blocked(): Money { return this._blocked; }
  get currency(): string { return this._currency; }
  get updatedAt(): Date { return this._updatedAt; }

  /**
   * Cria uma nova conta
   */
  static create(props: {
    id: string;
    storeId: string;
    currency?: string;
  }): Account {
    const currency = props.currency ?? 'BRL';

    return new Account({
      ...props,
      available: new Money(0, currency as Currency),
      pending: new Money(0, currency as Currency),
      blocked: new Money(0, currency as Currency),
      currency,
      updatedAt: new Date(),
    });
  }

  /**
   * Recria uma instância de Account a partir de dados persistidos
   */
  static fromPersistence(props: {
    id: string;
    storeId: string;
    available: number;
    pending: number;
    blocked: number;
    currency: string;
    updatedAt: Date;
  }): Account {
    return new Account({
      ...props,
      available: new Money(props.available, props.currency as Currency),
      pending: new Money(props.pending, props.currency as Currency),
      blocked: new Money(props.blocked, props.currency as Currency),
    });
  }

  /**
   * Adiciona saldo ao balance disponível
   */
  addAvailable(amount: Money): void {
    this.assertSameCurrency(amount);
    this._available = this._available.add(amount);
    this._updatedAt = new Date();
  }

  /**
   * Subtrai saldo do balance disponível
   */
  subtractAvailable(amount: Money): void {
    this.assertSameCurrency(amount);
    if (amount.greaterThan(this._available)) {
      throw new Error('Insufficient available balance');
    }
    this._available = this._available.subtract(amount);
    this._updatedAt = new Date();
  }

  /**
   * Adiciona saldo ao balance pendente
   */
  addPending(amount: Money): void {
    this.assertSameCurrency(amount);
    this._pending = this._pending.add(amount);
    this._updatedAt = new Date();
  }

  /**
   * Libera saldo de pendente para disponível
   */
  releasePending(amount: Money): void {
    this.assertSameCurrency(amount);
    if (amount.greaterThan(this._pending)) {
      throw new Error('Insufficient pending balance');
    }
    this._pending = this._pending.subtract(amount);
    this._available = this._available.add(amount);
    this._updatedAt = new Date();
  }

  /**
   * Bloqueia saldo do disponível
   */
  blockAvailable(amount: Money): void {
    this.assertSameCurrency(amount);
    if (amount.greaterThan(this._available)) {
      throw new Error('Insufficient available balance to block');
    }
    this._available = this._available.subtract(amount);
    this._blocked = this._blocked.add(amount);
    this._updatedAt = new Date();
  }

  /**
   * Desbloqueia saldo de volta para disponível
   */
  unblockToAvailable(amount: Money): void {
    this.assertSameCurrency(amount);
    if (amount.greaterThan(this._blocked)) {
      throw new Error('Insufficient blocked balance to unblock');
    }
    this._blocked = this._blocked.subtract(amount);
    this._available = this._available.add(amount);
    this._updatedAt = new Date();
  }

  /**
   * Deduz saldo bloqueado (para saques processados, por exemplo)
   */
  deductBlocked(amount: Money): void {
    this.assertSameCurrency(amount);
    if (amount.greaterThan(this._blocked)) {
      throw new Error('Insufficient blocked balance to deduct');
    }
    this._blocked = this._blocked.subtract(amount);
    this._updatedAt = new Date();
  }

  /**
   * Retorna o balance total (disponível + pendente)
   */
  getTotalBalance(): Money {
    return this._available.add(this._pending);
  }

  private assertSameCurrency(amount: Money): void {
    if (amount.currency !== this._currency) {
      throw new Error(`Currency mismatch: expected ${this._currency}, got ${amount.currency}`);
    }
  }

  /**
   * Retorna os dados prontos para persistência
   */
  toPersistence(): {
    id: string;
    storeId: string;
    available: number;
    pending: number;
    blocked: number;
    currency: string;
    updatedAt: Date;
  } {
    return {
      id: this._id,
      storeId: this._storeId,
      available: this._available.amountInCents,
      pending: this._pending.amountInCents,
      blocked: this._blocked.amountInCents,
      currency: this._currency,
      updatedAt: this._updatedAt,
    };
  }
}
