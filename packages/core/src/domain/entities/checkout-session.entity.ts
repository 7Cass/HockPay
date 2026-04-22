export type SessionStatus = 'OPEN' | 'COMPLETED' | 'EXPIRED';
export enum CustomerCollectionMode {
  IDENTIFIED = 'IDENTIFIED',
  GUEST = 'GUEST',
}

export interface CheckoutSessionPrefillCustomer {
  externalId?: string;
  document?: string;
  name?: string;
  email?: string;
}

export interface CheckoutSessionProps {
  id?: string;
  storeId: string;
  amount: number;
  currency?: string;
  description?: string;
  customerCollectionMode?: CustomerCollectionMode;
  prefillCustomer?: CheckoutSessionPrefillCustomer | null;
  paymentId?: string;
  checkoutToken: string;
  status?: SessionStatus;
  expiresAt: Date;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CheckoutSession {
  private props: Required<CheckoutSessionProps>;

  private constructor(props: CheckoutSessionProps) {
    this.props = {
      ...props,
      id: props.id ?? crypto.randomUUID(),
      currency: props.currency ?? 'BRL',
      description: props.description ?? null,
      customerCollectionMode:
        props.customerCollectionMode ?? CustomerCollectionMode.IDENTIFIED,
      prefillCustomer: props.prefillCustomer ?? null,
      paymentId: props.paymentId ?? null,
      status: props.status ?? 'OPEN',
      successUrl: props.successUrl ?? null,
      cancelUrl: props.cancelUrl ?? null,
      metadata: props.metadata ?? null,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    } as Required<CheckoutSessionProps>;
  }

  public static create(props: CheckoutSessionProps): CheckoutSession {
    return new CheckoutSession(props);
  }

  // Getters
  get id(): string { return this.props.id; }
  get storeId(): string { return this.props.storeId; }
  get amount(): number { return this.props.amount; }
  get currency(): string { return this.props.currency; }
  get description(): string | null { return this.props.description; }
  get customerCollectionMode(): CustomerCollectionMode { return this.props.customerCollectionMode; }
  get prefillCustomer(): CheckoutSessionPrefillCustomer | null { return this.props.prefillCustomer; }
  get paymentId(): string | null { return this.props.paymentId; }
  get checkoutToken(): string { return this.props.checkoutToken; }
  get status(): SessionStatus { return this.props.status; }
  get expiresAt(): Date { return this.props.expiresAt; }
  get successUrl(): string | null { return this.props.successUrl; }
  get cancelUrl(): string | null { return this.props.cancelUrl; }
  get metadata(): Record<string, unknown> | null { return this.props.metadata; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  // Actions
  public fulfill(paymentId: string): void {
    if (this.props.status !== 'OPEN') {
      throw new Error('Cannot fulfill a session that is not OPEN');
    }
    this.props.paymentId = paymentId;
    this.props.status = 'COMPLETED';
    this.props.updatedAt = new Date();
  }

  public expire(): void {
    if (this.props.status === 'OPEN') {
      this.props.status = 'EXPIRED';
      this.props.updatedAt = new Date();
    }
  }

  public toObject() {
    return { ...this.props };
  }
}
