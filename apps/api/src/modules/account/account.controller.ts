import {
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    UseGuards,
    NotFoundException,
    Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { GetAccountUseCase, AccountNotFoundError } from '@hockpay/core';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { AccountResponseDto } from './dtos/account-response.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentStore } from '../auth/decorators/current-store.decorator';

@Controller('accounts')
@Public()
@UseGuards(CombinedAuthGuard)
export class AccountController {
    constructor(private readonly getAccountUseCase: GetAccountUseCase) { }

    /**
     * GET /api/v1/accounts/me
     *
     * Gets the account balance for the currently authenticated store.
     * Returns balances in raw cents.
     */
    @Get('me')
    @HttpCode(HttpStatus.OK)
    async getMyAccount(@CurrentStore() storeId: string): Promise<AccountResponseDto> {
        try {
            const result = await this.getAccountUseCase.execute({ storeId });

            return {
                account: result.account,
            };
        } catch (error) {
            if (error instanceof AccountNotFoundError) {
                throw new NotFoundException({
                    error: {
                        code: error.code,
                        message: error.message,
                    },
                });
            }
            throw error;
        }
    }
}
