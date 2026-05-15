export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED' | 'FAILED';
export type SessionStatus = 'OPEN' | 'COMPLETED' | 'EXPIRED';
export type Environment = 'TEST' | 'LIVE';
export type CustomerCollectionMode = 'IDENTIFIED' | 'GUEST';

export interface CheckoutSessionCustomerInputState {
  hasDocument: boolean;
  hasName: boolean;
  hasEmail: boolean;
  maskedDocument?: string;
  maskedName?: string;
  maskedEmail?: string;
}

export interface CheckoutPayment {
  id: string;
  amount: number;
  currency: string;
  description?: string;
  status: PaymentStatus;
  environment: Environment;
  pixCharge?: PixCharge;
  expiresAt: string;
  paidAt?: string;
  createdAt: string;
}

export interface PixCharge {
  id: string;
  status: 'OPEN' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  pixQrCode: string;
  pixCopyPaste: string;
  pixTxId: string;
  expiresAt: string;
}

export interface CheckoutSession {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  customerCollectionMode: CustomerCollectionMode;
  customerInputState: CheckoutSessionCustomerInputState;
  status: SessionStatus;
  expiresAt: string;
  store: {
    name: string;
  };
  paymentId: string | null;
  payment?: CheckoutPayment;
  successUrl: string | null;
  cancelUrl: string | null;
}

export type PaymentLinkStatus = 'ACTIVE' | 'OPENED' | 'PAID' | 'EXPIRED' | 'CANCELLED';

export interface PaymentLinkPublicSession {
  paymentLink: {
    id: string;
    publicToken: string;
    amount: number;
    currency: string;
    title: string | null;
    description: string | null;
    status: PaymentLinkStatus;
    expiresAt: string | null;
    cancelledAt: string | null;
  };
  pixCharge: PixCharge;
  lastPayment?: CheckoutPayment | null;
  actions: {
    canPay: boolean;
    canFail: boolean;
  };
}

export const TERMINAL_STATUSES: PaymentStatus[] = ['CONFIRMED', 'RELEASED', 'EXPIRED', 'FAILED'];

export function isTerminalStatus(status: PaymentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
