import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ListTransactionsUseCase, Environment } from '@hockpay/core';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentStore } from '../auth/decorators/current-store.decorator';
import { ListTransactionsQueryDto } from './dtos/list-transactions-query.dto';
import { ListTransactionsResponseDto } from './dtos/transaction-response.dto';
import { CurrentEnvironment } from '../auth/decorators/current-environment.decorator';

@Controller('transactions')
@Public()
@UseGuards(CombinedAuthGuard)
export class TransactionController {
  constructor(
    private readonly listTransactionsUseCase: ListTransactionsUseCase,
  ) {}

  /**
   * GET /api/v1/transactions
   *
   * Retrieves a paginated list of transactions for the current store.
   * Can be filtered by date range and transaction type.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listTransactions(
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<ListTransactionsResponseDto> {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.listTransactionsUseCase.execute({
      storeId,
      environment,
      page: query.page,
      limit: query.limit,
      startDate,
      endDate,
      type: query.type,
    });
  }
}
