import {
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    UseGuards,
    Query,
} from '@nestjs/common';
import { ListTransactionsUseCase } from '@hockpay/core';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentStore } from '../auth/decorators/current-store.decorator';
import { ListTransactionsQueryDto } from './dtos/list-transactions-query.dto';
import { ListTransactionsResponseDto } from './dtos/transaction-response.dto';

@Controller('transactions')
@Public()
@UseGuards(CombinedAuthGuard)
export class TransactionController {
    constructor(private readonly listTransactionsUseCase: ListTransactionsUseCase) { }

    /**
     * GET /v1/transactions
     * 
     * Retrieves a paginated list of transactions for the current store.
     * Can be filtered by date range and transaction type.
     */
    @Get()
    @HttpCode(HttpStatus.OK)
    async listTransactions(
        @CurrentStore() storeId: string,
        @Query() query: ListTransactionsQueryDto,
    ): Promise<ListTransactionsResponseDto> {

        const startDate = query.startDate ? new Date(query.startDate) : undefined;
        const endDate = query.endDate ? new Date(query.endDate) : undefined;

        return this.listTransactionsUseCase.execute({
            storeId,
            page: query.page,
            limit: query.limit,
            startDate,
            endDate,
            type: query.type,
        });
    }
}
