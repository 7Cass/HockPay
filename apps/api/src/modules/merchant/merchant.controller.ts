import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  CreateMerchantUseCase,
  GetMerchantUseCase,
  type ICreateMerchantOutput,
  type IGetMerchantOutput,
} from '@hockpay/core';
import { CreateMerchantDto } from './dtos/create-merchant.dto';
import { Public } from '../auth/decorators/public.decorator';

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
  @Public()
  async create(@Body() dto: CreateMerchantDto): Promise<ICreateMerchantOutput> {
    return await this.createMerchantUseCase.execute(dto);
  }

  @Get(':id')
  @Public()
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<IGetMerchantOutput> {
    return await this.getMerchantUseCase.execute(id);
  }
}
