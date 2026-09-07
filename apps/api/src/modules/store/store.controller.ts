import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CreateStoreUseCase,
  ListStoresUseCase,
  RequestLiveEnablementUseCase,
  UpdateStoreProfileUseCase,
} from '@hockpay/core';
import {
  CreateStoreDto,
  CreateStoreResponseDto,
} from './dtos/create-store.dto';
import { ListStoresResponseDto } from './dtos/list-stores.dto';
import { UpdateStoreProfileDto } from './dtos/update-store-profile.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator';

/**
 * Base cookie options for HTTP-only cookies.
 */
const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
  };
};

/**
 * Controller for Store endpoints.
 *
 * This controller handles store creation and listing operations.
 * Business logic is delegated to the use cases from the core layer.
 * All routes are protected by the global JWT guard.
 */
@Controller('stores')
export class StoreController {
  constructor(
    private readonly createStoreUseCase: CreateStoreUseCase,
    private readonly listStoresUseCase: ListStoresUseCase,
    private readonly updateStoreProfileUseCase: UpdateStoreProfileUseCase,
    private readonly requestLiveEnablementUseCase: RequestLiveEnablementUseCase,
  ) {}

  /**
   * POST /stores/:id/live-request
   *
   * Merchant asks the desk to open LIVE. TEST never depended on this and
   * still does not.
   */
  @Post(':id/live-request')
  @HttpCode(HttpStatus.OK)
  async requestLive(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    const result = await this.requestLiveEnablementUseCase.execute({
      storeId: id,
      merchantId: user.merchantId,
    });

    return { store: result.store };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateStore(
    @Param('id') id: string,
    @Body() dto: UpdateStoreProfileDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const result = await this.updateStoreProfileUseCase.execute({
      storeId: id,
      merchantId: user.merchantId,
      name: dto.name,
      city: dto.city,
    });
    return { store: result.store };
  }

  /**
   * POST /stores
   *
   * Creates a new store for the authenticated merchant.
   * Returns the created store and new tokens (with store context).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createStore(
    @Body() dto: CreateStoreDto,
    @CurrentUser() user: CurrentUserData,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CreateStoreResponseDto> {
    const cookieOptions = getCookieOptions();

    const result = await this.createStoreUseCase.execute({
      merchantId: user.merchantId,
      name: dto.name,
      slug: dto.slug,
    });

    response.cookie('hockpay_at', result.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    response.cookie('hockpay_rt', result.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/refresh',
    });

    return {
      store: result.store,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    };
  }

  /**
   * GET /stores
   *
   * Lists all stores for the authenticated merchant.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listStores(
    @CurrentUser() user: CurrentUserData,
  ): Promise<ListStoresResponseDto> {
    const result = await this.listStoresUseCase.execute({
      merchantId: user.merchantId,
    });

    return {
      stores: result.stores,
    };
  }
}
