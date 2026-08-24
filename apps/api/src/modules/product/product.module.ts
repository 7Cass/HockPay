import { Module } from '@nestjs/common';
import {
  CreateProductUseCase,
  GetProductUseCase,
  ListProductsUseCase,
  UpdateProductUseCase,
} from '@hockpay/core';
import { ProductRepository } from '@hockpay/infrastructure';
import { provideUseCase } from 'src/common/provide-use-case';
import { ApiKeyModule } from '../api-key/api-key.module';
import { AuthModule } from '../auth/auth.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { ProductController } from './product.controller';

/**
 * Product Module
 *
 * ProductRepository vem do InfrastructureModule global.
 */
@Module({
  imports: [ApiKeyModule, AuthModule],
  controllers: [ProductController],
  providers: [
    CombinedAuthGuard,

    provideUseCase(CreateProductUseCase, [ProductRepository]),
    provideUseCase(ListProductsUseCase, [ProductRepository]),
    provideUseCase(GetProductUseCase, [ProductRepository]),
    provideUseCase(UpdateProductUseCase, [ProductRepository]),
  ],
})
export class ProductModule {}
