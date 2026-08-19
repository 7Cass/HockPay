import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  Environment,
  GetCustomerHistoryPaymentUseCase,
  GetCustomerHistoryReceiptUseCase,
  ListCustomerHistoryPaymentsUseCase,
  ListCustomerHistoryReceiptsUseCase,
} from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { CurrentEnvironment } from '../auth/decorators/current-environment.decorator';
import { CurrentStore } from '../auth/decorators/current-store.decorator';
import {
  CustomerHistoryPaymentDto,
  GetCustomerHistoryPaymentResponseDto,
  ListCustomerHistoryPaymentsQueryDto,
  ListCustomerHistoryPaymentsResponseDto,
} from './dtos/payment-history.dto';
import {
  CustomerHistoryReceiptDto,
  GetCustomerHistoryReceiptResponseDto,
  ListCustomerHistoryReceiptsQueryDto,
  ListCustomerHistoryReceiptsResponseDto,
} from './dtos/receipt-history.dto';

@Controller('customer-history/customers/:customerExternalId')
@Public()
@UseGuards(CombinedAuthGuard)
export class CustomerHistoryController {
  constructor(
    private readonly listCustomerHistoryPaymentsUseCase: ListCustomerHistoryPaymentsUseCase,
    private readonly getCustomerHistoryPaymentUseCase: GetCustomerHistoryPaymentUseCase,
    private readonly listCustomerHistoryReceiptsUseCase: ListCustomerHistoryReceiptsUseCase,
    private readonly getCustomerHistoryReceiptUseCase: GetCustomerHistoryReceiptUseCase,
  ) {}

  @Get('payments')
  @HttpCode(HttpStatus.OK)
  async listPayments(
    @Param('customerExternalId') customerExternalId: string,
    @Query() query: ListCustomerHistoryPaymentsQueryDto,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Req() req: Request,
  ): Promise<ListCustomerHistoryPaymentsResponseDto> {
    this.ensureApiKeyRequest(req);

    const result = await this.listCustomerHistoryPaymentsUseCase.execute({
      storeId,
      customerExternalId,
      page: query.page,
      limit: query.limit,
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      environment,
    });

    return {
      payments: result.payments.map((payment) =>
        this.toPaymentResponse(payment),
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  @Get('payments/:paymentId')
  @HttpCode(HttpStatus.OK)
  async getPayment(
    @Param('customerExternalId') customerExternalId: string,
    @Param('paymentId') paymentId: string,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Req() req: Request,
  ): Promise<GetCustomerHistoryPaymentResponseDto> {
    this.ensureApiKeyRequest(req);

    const result = await this.getCustomerHistoryPaymentUseCase.execute({
      storeId,
      customerExternalId,
      paymentId,
      environment,
    });

    return {
      payment: this.toPaymentResponse(result.payment),
    };
  }

  @Get('receipts')
  @HttpCode(HttpStatus.OK)
  async listReceipts(
    @Param('customerExternalId') customerExternalId: string,
    @Query() query: ListCustomerHistoryReceiptsQueryDto,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Req() req: Request,
  ): Promise<ListCustomerHistoryReceiptsResponseDto> {
    this.ensureApiKeyRequest(req);

    const result = await this.listCustomerHistoryReceiptsUseCase.execute({
      storeId,
      customerExternalId,
      environment,
      page: query.page,
      limit: query.limit,
      receiptNumber: query.receiptNumber,
    });

    return {
      receipts: result.receipts.map((receipt) =>
        this.toReceiptResponse(receipt),
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  @Get('receipts/:receiptId')
  @HttpCode(HttpStatus.OK)
  async getReceipt(
    @Param('customerExternalId') customerExternalId: string,
    @Param('receiptId') receiptId: string,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Req() req: Request,
  ): Promise<GetCustomerHistoryReceiptResponseDto> {
    this.ensureApiKeyRequest(req);

    const result = await this.getCustomerHistoryReceiptUseCase.execute({
      storeId,
      customerExternalId,
      receiptId,
      environment,
    });

    return {
      receipt: this.toReceiptResponse(result.receipt),
    };
  }

  private ensureApiKeyRequest(req: Request): void {
    if (req.authType !== 'api_key') {
      throw new ForbiddenException(
        'Customer history endpoints are only available via API key authentication',
      );
    }
  }

  private toPaymentResponse(payment: any): CustomerHistoryPaymentDto {
    return {
      id: payment.id,
      externalId: payment.externalId,
      amount: payment.amount,
      fee: payment.fee,
      netAmount: payment.netAmount,
      currency: payment.currency,
      description: payment.description,
      payerName: payment.payerName,
      payerDocument: payment.payerDocument,
      payerEmail: payment.payerEmail,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      pixTxId: payment.pixCharge?.pixTxId,
      expiresAt: payment.expiresAt,
      paidAt: payment.paidAt,
      releasedAt: payment.releasedAt,
      failedReason: payment.failedReason,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  private toReceiptResponse(receipt: any): CustomerHistoryReceiptDto {
    return {
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      paymentId: receipt.paymentId,
      payerName: receipt.payerName,
      payerDocument: receipt.payerDocument,
      payerEmail: receipt.payerEmail,
      payeeName: receipt.payeeName,
      payeeDocument: receipt.payeeDocument,
      amount: receipt.amount,
      fee: receipt.fee,
      netAmount: receipt.netAmount,
      currency: receipt.currency,
      description: receipt.description,
      status: receipt.status,
      issuedAt: receipt.issuedAt,
      createdAt: receipt.createdAt,
      updatedAt: receipt.updatedAt,
    };
  }
}
