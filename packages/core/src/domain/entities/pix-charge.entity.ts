export enum PixChargeStatus {
  OPEN = "OPEN",
  PAID = "PAID",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
}

export interface PixChargeProps {
  id: string;
  storeId: string;
  amount: number;
  currency: string;
  status: PixChargeStatus;
  pixQrCode: string;
  pixCopyPaste: string;
  pixTxId: string;
  expiresAt: Date;
  paidAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePixChargeProps {
  storeId: string;
  amount: number;
  currency?: string;
  pixQrCode: string;
  pixCopyPaste: string;
  pixTxId: string;
  expiresAt: Date;
}

export type PixChargeObject = PixChargeProps;

export class PixCharge {
  private constructor(private readonly props: PixChargeProps) {}

  static create(props: CreatePixChargeProps): PixCharge {
    const now = new Date();

    return new PixCharge({
      id: crypto.randomUUID(),
      storeId: props.storeId,
      amount: props.amount,
      currency: props.currency ?? "BRL",
      status: PixChargeStatus.OPEN,
      pixQrCode: props.pixQrCode,
      pixCopyPaste: props.pixCopyPaste,
      pixTxId: props.pixTxId,
      expiresAt: props.expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: PixChargeProps): PixCharge {
    return new PixCharge(props);
  }

  get id(): string { return this.props.id; }
  get storeId(): string { return this.props.storeId; }
  get amount(): number { return this.props.amount; }
  get currency(): string { return this.props.currency; }
  get status(): PixChargeStatus { return this.props.status; }
  get pixQrCode(): string { return this.props.pixQrCode; }
  get pixCopyPaste(): string { return this.props.pixCopyPaste; }
  get pixTxId(): string { return this.props.pixTxId; }
  get expiresAt(): Date { return this.props.expiresAt; }
  get paidAt(): Date | undefined { return this.props.paidAt; }
  get cancelledAt(): Date | undefined { return this.props.cancelledAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  isOpen(): boolean {
    return this.props.status === PixChargeStatus.OPEN;
  }

  isTerminal(): boolean {
    return this.props.status !== PixChargeStatus.OPEN;
  }

  hasExpired(now = new Date()): boolean {
    return this.isOpen() && now > this.props.expiresAt;
  }

  markPaid(): void {
    if (this.props.status === PixChargeStatus.PAID) return;
    if (this.props.status !== PixChargeStatus.OPEN) {
      throw new Error(`Pix charge cannot be paid from ${this.props.status}`);
    }

    this.props.status = PixChargeStatus.PAID;
    this.props.paidAt = new Date();
    this.props.updatedAt = new Date();
  }

  expire(): void {
    if (this.props.status === PixChargeStatus.EXPIRED) return;
    if (this.props.status !== PixChargeStatus.OPEN) return;

    this.props.status = PixChargeStatus.EXPIRED;
    this.props.updatedAt = new Date();
  }

  cancel(): void {
    if (this.props.status === PixChargeStatus.CANCELLED) return;
    if (this.props.status !== PixChargeStatus.OPEN) return;

    this.props.status = PixChargeStatus.CANCELLED;
    this.props.cancelledAt = new Date();
    this.props.updatedAt = new Date();
  }

  toObject(): PixChargeObject {
    return { ...this.props };
  }
}
