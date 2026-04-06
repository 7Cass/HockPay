import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  GetReceiptUseCase,
  ListReceiptsUseCase,
  ReceiptNotFoundError,
} from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
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
    @Req() req: Request,
  ): Promise<ListReceiptsResponseDto> {
    const storeId = (req as any)?.store?.id;

    if (!storeId) {
      throw new Error('Store ID not found in request');
    }

    const result = await this.listReceiptsUseCase.execute({
      storeId,
      page: query.page,
      limit: query.limit,
    });

    return {
      receipts: result.receipts.map(this.toResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getReceipt(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<GetReceiptResponseDto> {
    const storeId = (req as any)?.store?.id;

    if (!storeId) {
      throw new Error('Store ID not found in request');
    }

    const result = await this.getReceiptUseCase.execute({
      receiptId: id,
      storeId,
    });

    return {
      receipt: this.toResponse(result.receipt),
    };
  }

  @Get('payment/:paymentId')
  @HttpCode(HttpStatus.OK)
  async getReceiptByPayment(
    @Param('paymentId') paymentId: string,
    @Req() req: Request,
  ): Promise<GetReceiptResponseDto> {
    const storeId = (req as any)?.store?.id;

    if (!storeId) {
      throw new Error('Store ID not found in request');
    }

    const result = await this.getReceiptUseCase.execute({
      paymentId,
      storeId,
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
