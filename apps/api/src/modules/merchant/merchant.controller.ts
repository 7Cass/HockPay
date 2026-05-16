import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  CreateMerchantUseCase,
  GetMerchantUseCase,
  GetCurrentMerchantUseCase,
  type ICreateMerchantOutput,
  type IGetMerchantOutput,
  type IGetCurrentMerchantOutput,
} from '@hockpay/core';
import { CreateMerchantDto } from './dtos/create-merchant.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator';

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
    private readonly getCurrentMerchantUseCase: GetCurrentMerchantUseCase,
  ) {}

  @Post()
  @Public()
  async create(@Body() dto: CreateMerchantDto): Promise<ICreateMerchantOutput> {
    return await this.createMerchantUseCase.execute(dto);
  }

  /**
   * GET /merchants/me
   *
   * Returns the authenticated merchant's non-sensitive profile data.
   * Protected by the global JWT guard.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(
    @CurrentUser() user: CurrentUserData,
  ): Promise<IGetCurrentMerchantOutput> {
    return await this.getCurrentMerchantUseCase.execute(user.merchantId);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<IGetMerchantOutput> {
    if (id !== user.merchantId) {
      throw new ForbiddenException({
        error: {
          code: 'MERCHANT_ACCESS_DENIED',
          message: 'Cannot access another merchant profile',
        },
      });
    }

    return await this.getMerchantUseCase.execute(id);
  }
}
