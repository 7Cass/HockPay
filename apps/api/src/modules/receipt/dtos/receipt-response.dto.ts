import { ReceiptStatus } from '@hockpay/core';

export class ReceiptResponseDto {
  id: string;
  receiptNumber: string;
  paymentId: string;
  storeId: string;
  payerName?: string;
  payerDocument?: string;
  payerEmail?: string;
  payeeName: string;
  payeeDocument?: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  description?: string;
  status: ReceiptStatus;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class GetReceiptResponseDto {
  receipt: ReceiptResponseDto;
}

export class ListReceiptsResponseDto {
  receipts: ReceiptResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
