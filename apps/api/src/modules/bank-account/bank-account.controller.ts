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
} from '@nestjs/common';
import {
  CreateBankAccountUseCase,
  ListBankAccountsUseCase,
  DeleteBankAccountUseCase,
  SetDefaultBankAccountUseCase,
} from '@hockpay/core';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { JwtOnlyGuard } from '../auth/guards/jwt-only.guard';
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
    private readonly setDefaultBankAccountUseCase: SetDefaultBankAccountUseCase,
  ) {}

  @Post()
  @UseGuards(JwtOnlyGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentStore() storeId: string,
    @Body() createDto: CreateBankAccountDto,
  ): Promise<BankAccountResponseDto> {
    const bankAccount = await this.createBankAccountUseCase.execute({
      ...createDto,
      storeId,
    });

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
  @UseGuards(JwtOnlyGuard)
  @HttpCode(HttpStatus.OK)
  async setDefault(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
  ): Promise<void> {
    await this.setDefaultBankAccountUseCase.execute(id, storeId);
  }

  @Delete(':id')
  @UseGuards(JwtOnlyGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
  ): Promise<void> {
    await this.deleteBankAccountUseCase.execute(id, storeId);
  }
}
