import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateProductUseCase,
  Environment,
  GetProductUseCase,
  ListProductsUseCase,
  UpdateProductUseCase,
} from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { CurrentStore } from '../auth/decorators/current-store.decorator';
import { CurrentEnvironment } from '../auth/decorators/current-environment.decorator';
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
  async create(
    @Body() dto: CreateProductDto,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
  ) {
    return this.createUseCase.execute({
      storeId,
      environment,
      externalId: dto.externalId,
      name: dto.name,
      description: dto.description,
      price: dto.price,
      imageUrl: dto.imageUrl,
      metadata: dto.metadata,
    });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Query() query: ListProductsDto,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
  ) {
    return this.listUseCase.execute({
      storeId,
      environment,
      page: query.page,
      limit: query.limit,
      externalId: query.externalId,
      isActive: query.isActive,
      search: query.search,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async get(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
  ) {
    return this.getUseCase.execute({
      storeId,
      environment,
      productId: id,
    });
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
  ) {
    return this.updateUseCase.execute({
      storeId,
      environment,
      productId: id,
      externalId: dto.externalId,
      name: dto.name,
      description: dto.description,
      price: dto.price,
      imageUrl: dto.imageUrl,
      metadata: dto.metadata,
      isActive: dto.isActive,
    });
  }
}
