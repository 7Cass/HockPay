import { PaymentStatus } from '../enums/payment-status.enum';
import { Environment } from '../value-objects/environment.vo';
import { PixChargeObject, PixChargeStatus } from './pix-charge.entity';
import { PaymentObject } from './payment.entity';
import { LineItemObject } from './line-item.entity';

export type PaymentLinkStatus = 'ACTIVE' | 'OPENED' | 'PAID' | 'EXPIRED' | 'CANCELLED';

export interface PaymentLinkProps {
  id?: string;
  storeId: string;
  pixChargeId: string;
  publicToken: string;
  amount: number;
  currency?: string;
  environment?: Environment;
  title?: string;
  description?: string;
  internalReference?: string;
  expiresAt?: Date | null;
  openedAt?: Date | null;
  cancelledAt?: Date | null;
  items?: LineItemObject[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PaymentLinkObject {
  id: string;
  storeId: string;
  pixChargeId: string;
  publicToken: string;
  amount: number;
  currency: string;
  environment: Environment;
  title: string | null;
  description: string | null;
  internalReference: string | null;
  expiresAt: Date | null;
  openedAt: Date | null;
  cancelledAt: Date | null;
  items: LineItemObject[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentLinkListItem extends PaymentLinkObject {
  checkoutUrl: string;
  status: PaymentLinkStatus;
  paymentId: string | null;
  paymentStatus: PaymentStatus | null;
  pixCharge: PixChargeObject;
  failedPaymentCount: number;
  lastPaymentId: string | null;
  lastPaymentStatus: PaymentStatus | null;
  lastPayment?: PaymentObject | null;
  lastFailedAt: Date | null;
  attempts?: PaymentObject[];
}

export interface PaymentLinkStats {
  total: number;
  active: number;
  opened: number;
  pending: number;
  paid: number;
  expired: number;
  cancelled: number;
  conversionRate: number;
  paidAmount: number;
}

export class PaymentLink {
  private props: Required<
    Omit<
      PaymentLinkProps,
      'expiresAt' | 'openedAt' | 'cancelledAt' | 'title' | 'description' | 'internalReference'
    >
  > & {
    title: string | null;
    description: string | null;
    internalReference: string | null;
    expiresAt: Date | null;
    openedAt: Date | null;
    cancelledAt: Date | null;
  };

  private constructor(props: PaymentLinkProps) {
    const now = new Date();
    this.props = {
      id: props.id ?? crypto.randomUUID(),
      storeId: props.storeId,
      pixChargeId: props.pixChargeId,
      publicToken: props.publicToken,
      amount: props.amount,
      currency: props.currency ?? 'BRL',
      environment: props.environment ?? Environment.TEST,
      title: props.title ?? null,
      description: props.description ?? null,
      internalReference: props.internalReference ?? null,
      expiresAt: props.expiresAt ?? null,
      openedAt: props.openedAt ?? null,
      cancelledAt: props.cancelledAt ?? null,
      items: props.items ?? [],
      createdAt: props.createdAt ?? now,
      updatedAt: props.updatedAt ?? now,
    };
  }

  static create(props: PaymentLinkProps): PaymentLink {
    return new PaymentLink(props);
  }

  static reconstitute(props: PaymentLinkProps): PaymentLink {
    return new PaymentLink(props);
  }

  get id(): string {
    return this.props.id;
  }
  get storeId(): string {
    return this.props.storeId;
  }
  get pixChargeId(): string {
    return this.props.pixChargeId;
  }
  get publicToken(): string {
    return this.props.publicToken;
  }
  get amount(): number {
    return this.props.amount;
  }
  get currency(): string {
    return this.props.currency;
  }
  get environment(): Environment {
    return this.props.environment;
  }
  get title(): string | null {
    return this.props.title;
  }
  get description(): string | null {
    return this.props.description;
  }
  get internalReference(): string | null {
    return this.props.internalReference;
  }
  get expiresAt(): Date | null {
    return this.props.expiresAt;
  }
  get openedAt(): Date | null {
    return this.props.openedAt;
  }
  get cancelledAt(): Date | null {
    return this.props.cancelledAt;
  }
  get items(): LineItemObject[] {
    return this.props.items;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isCancelled(): boolean {
    return Boolean(this.props.cancelledAt);
  }

  isExpired(now = new Date()): boolean {
    return Boolean(this.props.expiresAt && now > this.props.expiresAt);
  }

  markOpened(): void {
    if (!this.props.openedAt) {
      this.props.openedAt = new Date();
      this.props.updatedAt = new Date();
    }
  }

  cancel(): void {
    if (!this.props.cancelledAt) {
      this.props.cancelledAt = new Date();
      this.props.updatedAt = new Date();
    }
  }

  toObject(): PaymentLinkObject {
    return { ...this.props };
  }
}

export function computePaymentLinkStatus(input: {
  link: PaymentLinkObject;
  paymentStatus?: PaymentStatus | null;
  pixChargeStatus?: PixChargeStatus | null;
  now?: Date;
}): PaymentLinkStatus {
  if (input.link.cancelledAt) return 'CANCELLED';
  if (
    input.pixChargeStatus === PixChargeStatus.PAID ||
    input.paymentStatus === PaymentStatus.CONFIRMED ||
    input.paymentStatus === PaymentStatus.RELEASED
  ) {
    return 'PAID';
  }
  if (
    input.pixChargeStatus === PixChargeStatus.EXPIRED ||
    input.pixChargeStatus === PixChargeStatus.CANCELLED ||
    input.paymentStatus === PaymentStatus.EXPIRED ||
    (input.link.expiresAt && (input.now ?? new Date()) > input.link.expiresAt)
  ) {
    return input.pixChargeStatus === PixChargeStatus.CANCELLED ? 'CANCELLED' : 'EXPIRED';
  }
  if (input.link.openedAt || input.paymentStatus === PaymentStatus.PENDING) {
    return 'OPENED';
  }
  return 'ACTIVE';
}
