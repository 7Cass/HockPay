import { RefundStatus } from '@hockpay/core';

export class RefundResponseDto {
  id: string;
  paymentId: string;
  amount: number;
  feeRefunded: number;
  reason?: string;
  status: RefundStatus;
  processedAt?: Date;
  createdAt: Date;
}

export class CreateRefundResponseDto {
  refund: RefundResponseDto;
  payment: any;
}
