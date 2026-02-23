import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  CreateMerchantUseCase,
  GetMerchantUseCase,
  type ICreateMerchantInput,
  type ICreateMerchantOutput,
  type IGetMerchantOutput,
} from '@hockpay/core';

/**
 * Controller for Merchant endpoints.
 *
 * This controller is responsible only for handling HTTP requests/responses.
 * Business logic is delegated to the use cases from the core layer.
 */
@Controller('merchants')
export class MerchantController {
  constructor(
    private readonly createMerchantUseCase: CreateMerchantUseCase,
    private readonly getMerchantUseCase: GetMerchantUseCase,
  ) {}

  @Post()
  async create(
    @Body() dto: ICreateMerchantInput,
  ): Promise<ICreateMerchantOutput> {
    console.log('received');
    return await this.createMerchantUseCase.execute(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<IGetMerchantOutput> {
    return await this.getMerchantUseCase.execute(id);
  }
}
