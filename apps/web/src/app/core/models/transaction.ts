export type TransactionType =
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_RELEASED'
  | 'REFUND_DEDUCTED'
  | 'NEGATIVE_COMPENSATED'
  | 'WITHDRAWAL_RESERVED'
  | 'WITHDRAWAL_SENT'
  | 'WITHDRAWAL_REVERSED'
  | 'FEE_CHARGED'
  | 'ADJUSTMENT';

export interface TransactionObject {
  id: string;
  accountId: string;
  type: TransactionType | string;
  amount: number;
  fee: number;
  netAmount: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}
