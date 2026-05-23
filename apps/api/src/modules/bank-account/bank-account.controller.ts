import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  CreateBankAccountUseCase,
  ListBankAccountsUseCase,
  DeleteBankAccountUseCase,
  GetMerchantUseCase,
  SetDefaultBankAccountUseCase,
} from '@hockpay/core';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { CurrentStore } from '../auth/decorators/current-store.decorator';
import { CreateBankAccountDto } from './dtos/create-bank-account.dto';
import { BankAccountResponseDto } from './dtos/bank-account-response.dto';

@Controller({
  path: 'bank-accounts',
  version: '1',
})
@UseGuards(CombinedAuthGuard)
export class BankAccountController {
  constructor(
    private readonly createBankAccountUseCase: CreateBankAccountUseCase,
    private readonly listBankAccountsUseCase: ListBankAccountsUseCase,
    private readonly deleteBankAccountUseCase: DeleteBankAccountUseCase,
    private readonly getMerchantUseCase: GetMerchantUseCase,
    private readonly setDefaultBankAccountUseCase: SetDefaultBankAccountUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentStore() storeId: string,
    @Req() req: any,
    @Body() createDto: CreateBankAccountDto,
  ): Promise<BankAccountResponseDto> {
    // Retrieve the merchant document to satisfy Business Rule #1 (Titularidade)
    // JWT auth puts user in req.user, API Keys don't have user but we can fetch Merchant via store.merchantId
    const merchantId = req.user?.sub || req.user?.id || req.store?.merchantId;
    const merchant = await this.getMerchantUseCase.execute(merchantId);

    const bankAccount = await this.createBankAccountUseCase.execute(
      {
        ...createDto,
        storeId,
      },
      merchant.document,
    );

    return BankAccountResponseDto.fromDomain(bankAccount);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @CurrentStore() storeId: string,
  ): Promise<BankAccountResponseDto[]> {
    const bankAccounts = await this.listBankAccountsUseCase.execute(storeId);
    return BankAccountResponseDto.fromUsageList(bankAccounts);
  }

  @Patch(':id/default')
  @HttpCode(HttpStatus.OK)
  async setDefault(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
  ): Promise<void> {
    await this.setDefaultBankAccountUseCase.execute(id, storeId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
  ): Promise<void> {
    await this.deleteBankAccountUseCase.execute(id, storeId);
  }
}
