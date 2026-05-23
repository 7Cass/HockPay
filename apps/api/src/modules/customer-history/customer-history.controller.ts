import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CustomerNotFoundError,
  GetCustomerHistoryPaymentUseCase,
  GetCustomerHistoryReceiptUseCase,
  ListCustomerHistoryPaymentsUseCase,
  ListCustomerHistoryReceiptsUseCase,
  PaymentNotFoundError,
  ReceiptNotFoundError,
} from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
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
    @Req() req: Request,
  ): Promise<ListCustomerHistoryPaymentsResponseDto> {
    const storeId = this.ensureApiKeyRequest(req);

    try {
      const result = await this.listCustomerHistoryPaymentsUseCase.execute({
        storeId,
        customerExternalId,
        page: query.page,
        limit: query.limit,
        status: query.status,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
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
    } catch (error) {
      if (error instanceof CustomerNotFoundError) {
        throw this.toNotFoundException(error);
      }
      throw error;
    }
  }

  @Get('payments/:paymentId')
  @HttpCode(HttpStatus.OK)
  async getPayment(
    @Param('customerExternalId') customerExternalId: string,
    @Param('paymentId') paymentId: string,
    @Req() req: Request,
  ): Promise<GetCustomerHistoryPaymentResponseDto> {
    const storeId = this.ensureApiKeyRequest(req);

    try {
      const result = await this.getCustomerHistoryPaymentUseCase.execute({
        storeId,
        customerExternalId,
        paymentId,
      });

      return {
        payment: this.toPaymentResponse(result.payment),
      };
    } catch (error) {
      if (
        error instanceof CustomerNotFoundError ||
        error instanceof PaymentNotFoundError
      ) {
        throw this.toNotFoundException(error);
      }
      throw error;
    }
  }

  @Get('receipts')
  @HttpCode(HttpStatus.OK)
  async listReceipts(
    @Param('customerExternalId') customerExternalId: string,
    @Query() query: ListCustomerHistoryReceiptsQueryDto,
    @Req() req: Request,
  ): Promise<ListCustomerHistoryReceiptsResponseDto> {
    const storeId = this.ensureApiKeyRequest(req);

    try {
      const result = await this.listCustomerHistoryReceiptsUseCase.execute({
        storeId,
        customerExternalId,
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
    } catch (error) {
      if (error instanceof CustomerNotFoundError) {
        throw this.toNotFoundException(error);
      }
      throw error;
    }
  }

  @Get('receipts/:receiptId')
  @HttpCode(HttpStatus.OK)
  async getReceipt(
    @Param('customerExternalId') customerExternalId: string,
    @Param('receiptId') receiptId: string,
    @Req() req: Request,
  ): Promise<GetCustomerHistoryReceiptResponseDto> {
    const storeId = this.ensureApiKeyRequest(req);

    try {
      const result = await this.getCustomerHistoryReceiptUseCase.execute({
        storeId,
        customerExternalId,
        receiptId,
      });

      return {
        receipt: this.toReceiptResponse(result.receipt),
      };
    } catch (error) {
      if (
        error instanceof CustomerNotFoundError ||
        error instanceof ReceiptNotFoundError ||
        error instanceof PaymentNotFoundError
      ) {
        throw this.toNotFoundException(error);
      }
      throw error;
    }
  }

  private ensureApiKeyRequest(req: Request): string {
    if ((req as any).authType !== 'api_key') {
      throw new ForbiddenException(
        'Customer history endpoints are only available via API key authentication',
      );
    }

    const storeId = (req as any)?.store?.id;

    if (!storeId) {
      throw new ForbiddenException('Store ID not found in request');
    }

    return storeId;
  }

  private toNotFoundException(error: { code: string; message: string }) {
    return new NotFoundException({
      error: {
        code: error.code,
        message: error.message,
      },
    });
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
