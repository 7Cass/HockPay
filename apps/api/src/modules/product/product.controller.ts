import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CreateProductUseCase,
  Environment,
  GetProductUseCase,
  InvalidLineItemsError,
  InvalidProductError,
  ListProductsUseCase,
  ProductExternalIdAlreadyExistsError,
  ProductNotFoundError,
  UpdateProductUseCase,
} from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import {
  CreateProductDto,
  ListProductsDto,
  UpdateProductDto,
} from './dtos/product.dto';

@Controller('products')
@Public()
@UseGuards(CombinedAuthGuard)
export class ProductController {
  constructor(
    private readonly createUseCase: CreateProductUseCase,
    private readonly listUseCase: ListProductsUseCase,
    private readonly getUseCase: GetProductUseCase,
    private readonly updateUseCase: UpdateProductUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProductDto, @Req() req?: Request) {
    try {
      const context = this.getContext(req);
      return await this.createUseCase.execute({
        ...context,
        externalId: dto.externalId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        imageUrl: dto.imageUrl,
        metadata: dto.metadata,
      });
    } catch (error) {
      this.mapError(error);
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(@Query() query: ListProductsDto, @Req() req?: Request) {
    const context = this.getContext(req);
    return this.listUseCase.execute({
      ...context,
      page: query.page,
      limit: query.limit,
      externalId: query.externalId,
      isActive: query.isActive,
      search: query.search,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async get(@Param('id') id: string, @Req() req?: Request) {
    try {
      return await this.getUseCase.execute({
        ...this.getContext(req),
        productId: id,
      });
    } catch (error) {
      this.mapError(error);
    }
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() req?: Request,
  ) {
    try {
      return await this.updateUseCase.execute({
        ...this.getContext(req),
        productId: id,
        externalId: dto.externalId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        imageUrl: dto.imageUrl,
        metadata: dto.metadata,
        isActive: dto.isActive,
      });
    } catch (error) {
      this.mapError(error);
    }
  }

  private getContext(req?: Request): {
    storeId: string;
    environment: Environment;
  } {
    const storeId = (req as any)?.store?.id;
    if (!storeId) throw new Error('Store ID not found in request');
    return {
      storeId,
      environment: ((req as any)?.environment ??
        Environment.TEST) as Environment,
    };
  }

  private mapError(error: unknown): never {
    if (error instanceof ProductNotFoundError) {
      throw new NotFoundException({
        error: { code: error.code, message: error.message },
      });
    }
    if (error instanceof ProductExternalIdAlreadyExistsError) {
      throw new ConflictException({
        error: { code: error.code, message: error.message },
      });
    }
    if (
      error instanceof InvalidLineItemsError ||
      error instanceof InvalidProductError
    ) {
      throw new UnprocessableEntityException({
        error: { code: error.code, message: error.message },
      });
    }
    throw error;
  }
}
