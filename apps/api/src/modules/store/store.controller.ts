import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CreateStoreUseCase,
  ListStoresUseCase,
  SlugAlreadyExistsError,
  InvalidSlugFormatError,
} from '@hockpay/core';
import {
  CreateStoreDto,
  CreateStoreResponseDto,
} from './dtos/create-store.dto';
import { ListStoresResponseDto } from './dtos/list-stores.dto';
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
  ) {}

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
    try {
      const cookieOptions = getCookieOptions();

      const result = await this.createStoreUseCase.execute({
        merchantId: user.merchantId,
        name: dto.name,
        slug: dto.slug,
      });

      // Set new refresh token as HTTP-only cookie
      response.cookie('hockpay_rt', result.refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/v1/auth/refresh',
      });

      return {
        store: result.store,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      };
    } catch (error) {
      if (error instanceof SlugAlreadyExistsError) {
        throw new ConflictException({
          code: error.code,
          message: error.message,
        });
      }
      if (error instanceof InvalidSlugFormatError) {
        throw new BadRequestException({
          code: error.code,
          message: error.message,
        });
      }
      throw error;
    }
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
