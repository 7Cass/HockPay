export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED' | 'FAILED';
export type SessionStatus = 'OPEN' | 'COMPLETED' | 'EXPIRED';
export type Environment = 'TEST' | 'LIVE';

export interface CheckoutPayment {
  id: string;
  amount: number;
  currency: string;
  description?: string;
  status: PaymentStatus;
  environment: Environment;
  pixQrCode: string;
  pixCopyPaste: string;
  expiresAt: string;
  paidAt?: string;
  createdAt: string;
}

export interface CheckoutSession {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
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

export const TERMINAL_STATUSES: PaymentStatus[] = ['CONFIRMED', 'RELEASED', 'EXPIRED', 'FAILED'];

export function isTerminalStatus(status: PaymentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
