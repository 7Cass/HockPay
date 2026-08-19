import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  Environment,
  GetReceiptUseCase,
  ListReceiptsUseCase,
} from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { CurrentStore } from '../auth/decorators/current-store.decorator';
import { CurrentEnvironment } from '../auth/decorators/current-environment.decorator';
import { ListReceiptsQueryDto } from './dtos/list-receipts.dto';
import {
  GetReceiptResponseDto,
  ListReceiptsResponseDto,
  ReceiptResponseDto,
} from './dtos/receipt-response.dto';

@Controller('receipts')
@Public()
@UseGuards(CombinedAuthGuard)
export class ReceiptController {
  constructor(
    private readonly getReceiptUseCase: GetReceiptUseCase,
    private readonly listReceiptsUseCase: ListReceiptsUseCase,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async listReceipts(
    @Query() query: ListReceiptsQueryDto,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
  ): Promise<ListReceiptsResponseDto> {
    const result = await this.listReceiptsUseCase.execute({
      storeId,
      environment,
      page: query.page,
      limit: query.limit,
      receiptNumber: query.receiptNumber,
      customerId: query.customerId,
    });

    return {
      receipts: result.receipts.map(this.toResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  @Get('number/:receiptNumber')
  @HttpCode(HttpStatus.OK)
  async getReceiptByNumber(
    @Param('receiptNumber') receiptNumber: string,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
  ): Promise<GetReceiptResponseDto> {
    const result = await this.getReceiptUseCase.execute({
      receiptNumber,
      storeId,
      environment,
    });

    return {
      receipt: this.toResponse(result.receipt),
    };
  }

  @Get('payment/:paymentId')
  @HttpCode(HttpStatus.OK)
  async getReceiptByPayment(
    @Param('paymentId') paymentId: string,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
  ): Promise<GetReceiptResponseDto> {
    const result = await this.getReceiptUseCase.execute({
      paymentId,
      storeId,
      environment,
    });

    return {
      receipt: this.toResponse(result.receipt),
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getReceipt(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
  ): Promise<GetReceiptResponseDto> {
    const result = await this.getReceiptUseCase.execute({
      receiptId: id,
      storeId,
      environment,
    });

    return {
      receipt: this.toResponse(result.receipt),
    };
  }

  private toResponse(receipt: any): ReceiptResponseDto {
    return {
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      paymentId: receipt.paymentId,
      customerId: receipt.customerId,
      storeId: receipt.storeId,
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
