import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { GetAccountUseCase } from '@hockpay/core';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { AccountResponseDto } from './dtos/account-response.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentStore } from '../auth/decorators/current-store.decorator';

@Controller('accounts')
@Public()
@UseGuards(CombinedAuthGuard)
export class AccountController {
  constructor(private readonly getAccountUseCase: GetAccountUseCase) {}

  /**
   * GET /api/v1/accounts/me
   *
   * Gets the account balance for the currently authenticated store.
   * Returns balances in raw cents.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMyAccount(
    @CurrentStore() storeId: string,
  ): Promise<AccountResponseDto> {
    const result = await this.getAccountUseCase.execute({ storeId });

    return {
      account: result.account,
    };
  }
}
