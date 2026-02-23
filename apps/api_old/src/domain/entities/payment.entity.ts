import { PaymentStatus } from '@hockpay/database';
import { Money, Currency } from '../value-objects';
import { DomainEvent } from '../events';
import {
  InvalidPaymentStateError,
  PaymentExpiredError,
  PaymentCannotBeConfirmedError,
  PaymentCannotBeExpiredError,
  PaymentAlreadyConfirmedError,
} from '../errors';
import { PaymentCreatedEvent, PaymentConfirmedEvent, PaymentExpiredEvent, PaymentFailedEvent, PaymentReleasedEvent } from '../events/payment-events';

/**
 * Status de transição válidos para cada operação
 */
const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [PaymentStatus.CONFIRMED, PaymentStatus.EXPIRED, PaymentStatus.FAILED],
  [PaymentStatus.CONFIRMED]: [PaymentStatus.RELEASED, PaymentStatus.REFUNDED],
  [PaymentStatus.RELEASED]: [PaymentStatus.REFUNDED],
  [PaymentStatus.EXPIRED]: [],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.REFUNDED]: [],
};

/**
 * Entidade de Domínio: Payment
 *
 * Agregado Root que representa um pagamento Pix.
 * Contém todas as regras de negócio relacionadas a pagamentos.
 */
export class Payment {
  private _id: string;
  private _storeId: string;
  private _customerId: string;
  private _externalId: string | null;
  private _amount: Money;
  private _fee: Money;
  private _netAmount: Money;
  private _description: string | null;
  private _status: PaymentStatus;
  private _pixQrCode: string | null;
  private _pixCopyPaste: string | null;
  private _pixTxId: string | null;
  private _checkoutUrl: string | null;
  private _expiresAt: Date;
  private _paidAt: Date | null;
  private _releasedAt: Date | null;
  private _failedReason: string | null;
  private _metadata: Record<string, unknown> | null;
  private _createdAt: Date;
  private _updatedAt: Date;

  // Domain Events
  private _domainEvents: DomainEvent[] = [];

  private constructor(props: {
    id: string;
    storeId: string;
    customerId: string;
    externalId: string | null;
    amount: Money;
    fee: Money;
    netAmount: Money;
    description: string | null;
    status: PaymentStatus;
    pixQrCode: string | null;
    pixCopyPaste: string | null;
    pixTxId: string | null;
    checkoutUrl: string | null;
    expiresAt: Date;
    paidAt: Date | null;
    releasedAt: Date | null;
    failedReason: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this._id = props.id;
    this._storeId = props.storeId;
    this._customerId = props.customerId;
    this._externalId = props.externalId;
    this._amount = props.amount;
    this._fee = props.fee;
    this._netAmount = props.netAmount;
    this._description = props.description;
    this._status = props.status;
    this._pixQrCode = props.pixQrCode;
    this._pixCopyPaste = props.pixCopyPaste;
    this._pixTxId = props.pixTxId;
    this._checkoutUrl = props.checkoutUrl;
    this._expiresAt = props.expiresAt;
    this._paidAt = props.paidAt;
    this._releasedAt = props.releasedAt;
    this._failedReason = props.failedReason;
    this._metadata = props.metadata;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  // Getters
  get id(): string { return this._id; }
  get storeId(): string { return this._storeId; }
  get customerId(): string { return this._customerId; }
  get externalId(): string | null { return this._externalId; }
  get amount(): Money { return this._amount; }
  get fee(): Money { return this._fee; }
  get netAmount(): Money { return this._netAmount; }
  get description(): string | null { return this._description; }
  get status(): PaymentStatus { return this._status; }
  get pixQrCode(): string | null { return this._pixQrCode; }
  get pixCopyPaste(): string | null { return this._pixCopyPaste; }
  get pixTxId(): string | null { return this._pixTxId; }
  get checkoutUrl(): string | null { return this._checkoutUrl; }
  get expiresAt(): Date { return this._expiresAt; }
  get paidAt(): Date | null { return this._paidAt; }
  get releasedAt(): Date | null { return this._releasedAt; }
  get failedReason(): string | null { return this._failedReason; }
  get metadata(): Record<string, unknown> | null { return this._metadata; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  /**
   * Cria um novo pagamento
   */
  static create(props: {
    id: string;
    storeId: string;
    customerId: string;
    externalId: string | null;
    amount: Money;
    fee: Money;
    netAmount: Money;
    description: string | null;
    expiresAt: Date;
    pixQrCode: string;
    pixCopyPaste: string;
    checkoutUrl: string;
    metadata?: Record<string, unknown> | null;
  }): Payment {
    const payment = new Payment({
      ...props,
      status: PaymentStatus.PENDING,
      pixTxId: null,
      paidAt: null,
      releasedAt: null,
      failedReason: null,
      metadata: props.metadata ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    payment.addDomainEvent(new PaymentCreatedEvent(
      payment.id,
      {
        storeId: payment.storeId,
        customerId: payment.customerId,
        amountInCents: payment.amount.amountInCents,
        currency: payment.amount.currency,
        expiresAt: payment.expiresAt.toISOString(),
      }
    ));

    return payment;
  }

  /**
   * Recria uma instância de Payment a partir de dados persistidos
   */
  static fromPersistence(props: {
    id: string;
    storeId: string;
    customerId: string;
    externalId: string | null;
    amount: number;
    fee: number;
    netAmount: number;
    currency: string;
    description: string | null;
    status: PaymentStatus;
    pixQrCode: string | null;
    pixCopyPaste: string | null;
    pixTxId: string | null;
    checkoutUrl: string | null;
    expiresAt: Date;
    paidAt: Date | null;
    releasedAt: Date | null;
    failedReason: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
  }): Payment {
    return new Payment({
      ...props,
      amount: new Money(props.amount, props.currency as Currency),
      fee: new Money(props.fee, props.currency as Currency),
      netAmount: new Money(props.netAmount, props.currency as Currency),
    });
  }

  /**
   * Confirma o pagamento
   */
  confirm(pixTxId?: string): void {
    this.validateCanConfirm();

    this._status = PaymentStatus.CONFIRMED;
    this._pixTxId = pixTxId ?? null;
    this._paidAt = new Date();
    this._updatedAt = new Date();

    this.addDomainEvent(new PaymentConfirmedEvent(
      this.id,
      {
        storeId: this.storeId,
        customerId: this.customerId,
        amountInCents: this.amount.amountInCents,
        currency: this.amount.currency,
        pixTxId: this._pixTxId ?? undefined,
        paidAt: this._paidAt.toISOString(),
      }
    ));
  }

  /**
   * Expira o pagamento
   */
  expire(): void {
    this.validateCanExpire();

    this._status = PaymentStatus.EXPIRED;
    this._updatedAt = new Date();

    this.addDomainEvent(new PaymentExpiredEvent(
      this.id,
      {
        storeId: this.storeId,
        customerId: this.customerId,
        amountInCents: this.amount.amountInCents,
        currency: this.amount.currency,
        expiredAt: this._updatedAt.toISOString(),
      }
    ));
  }

  /**
   * Falha o pagamento
   */
  fail(reason: string): void {
    this.validateCanFail();

    this._status = PaymentStatus.FAILED;
    this._failedReason = reason;
    this._updatedAt = new Date();

    this.addDomainEvent(new PaymentFailedEvent(
      this.id,
      {
        storeId: this.storeId,
        customerId: this.customerId,
        amountInCents: this.amount.amountInCents,
        currency: this.amount.currency,
        reason,
        failedAt: this._updatedAt.toISOString(),
      }
    ));
  }

  /**
   * Libera o saldo para a conta do merchant
   */
  release(accountId: string): void {
    this.validateCanRelease();

    this._status = PaymentStatus.RELEASED;
    this._releasedAt = new Date();
    this._updatedAt = new Date();

    this.addDomainEvent(new PaymentReleasedEvent(
      this.id,
      {
        storeId: this.storeId,
        accountId,
        amountInCents: this.netAmount.amountInCents,
        currency: this.netAmount.currency,
        releasedAt: this._releasedAt.toISOString(),
      }
    ));
  }

  /**
   * Reembolsa o pagamento
   */
  refund(): void {
    this.validateCanRefund();

    this._status = PaymentStatus.REFUNDED;
    this._updatedAt = new Date();

    // O evento de reembolso é criado pelo use case de reembolso
    // pois precisa incluir informações adicionais como motivo
  }

  /**
   * Verifica se o pagamento está expirado
   */
  isExpired(now: Date = new Date()): boolean {
    return now > this._expiresAt;
  }

  /**
   * Verifica se o pagamento está pendente
   */
  isPending(): boolean {
    return this._status === PaymentStatus.PENDING;
  }

  /**
   * Verifica se o pagamento está confirmado
   */
  isConfirmed(): boolean {
    return this._status === PaymentStatus.CONFIRMED;
  }

  /**
   * Verifica se o pagamento foi liberado
   */
  isReleased(): boolean {
    return this._status === PaymentStatus.RELEASED;
  }

  /**
   * Verifica se o pagamento expirou
   */
  isExpiredStatus(): boolean {
    return this._status === PaymentStatus.EXPIRED;
  }

  /**
   * Verifica se o pagamento falhou
   */
  isFailed(): boolean {
    return this._status === PaymentStatus.FAILED;
  }

  /**
   * Verifica se o pagamento foi reembolsado
   */
  isRefunded(): boolean {
    return this._status === PaymentStatus.REFUNDED;
  }

  /**
   * Limpa os domain events (depois de serem publicados)
   */
  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  private validateCanConfirm(): void {
    if (this._status === PaymentStatus.CONFIRMED) {
      throw new PaymentAlreadyConfirmedError(this.id, this._paidAt!);
    }

    if (!VALID_TRANSITIONS[this._status].includes(PaymentStatus.CONFIRMED)) {
      throw new PaymentCannotBeConfirmedError(this.id, this._status);
    }

    if (this.isExpired()) {
      throw new PaymentExpiredError(this._expiresAt);
    }
  }

  private validateCanExpire(): void {
    if (!VALID_TRANSITIONS[this._status].includes(PaymentStatus.EXPIRED)) {
      throw new PaymentCannotBeExpiredError(this.id, this._status);
    }
  }

  private validateCanFail(): void {
    if (!VALID_TRANSITIONS[this._status].includes(PaymentStatus.FAILED)) {
      throw new InvalidPaymentStateError(
        this._status,
        'fail',
        VALID_TRANSITIONS[this._status]
      );
    }
  }

  private validateCanRelease(): void {
    if (!VALID_TRANSITIONS[this._status].includes(PaymentStatus.RELEASED)) {
      throw new InvalidPaymentStateError(
        this._status,
        'release',
        VALID_TRANSITIONS[this._status]
      );
    }
  }

  private validateCanRefund(): void {
    if (!VALID_TRANSITIONS[this._status].includes(PaymentStatus.REFUNDED)) {
      throw new InvalidPaymentStateError(
        this._status,
        'refund',
        VALID_TRANSITIONS[this._status]
      );
    }
  }

  /**
   * Retorna os dados prontos para persistência
   */
  toPersistence(): {
    id: string;
    storeId: string;
    customerId: string;
    externalId: string | null;
    amount: number;
    fee: number;
    netAmount: number;
    currency: string;
    description: string | null;
    status: PaymentStatus;
    pixQrCode: string | null;
    pixCopyPaste: string | null;
    pixTxId: string | null;
    checkoutUrl: string | null;
    expiresAt: Date;
    paidAt: Date | null;
    releasedAt: Date | null;
    failedReason: string | null;
    metadata: Record<string, unknown> | null;
  } {
    return {
      id: this._id,
      storeId: this._storeId,
      customerId: this._customerId,
      externalId: this._externalId,
      amount: this._amount.amountInCents,
      fee: this._fee.amountInCents,
      netAmount: this._netAmount.amountInCents,
      currency: this._amount.currency,
      description: this._description,
      status: this._status,
      pixQrCode: this._pixQrCode,
      pixCopyPaste: this._pixCopyPaste,
      pixTxId: this._pixTxId,
      checkoutUrl: this._checkoutUrl,
      expiresAt: this._expiresAt,
      paidAt: this._paidAt,
      releasedAt: this._releasedAt,
      failedReason: this._failedReason,
      metadata: this._metadata,
    };
  }
}
