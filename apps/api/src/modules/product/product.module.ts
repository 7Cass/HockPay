import { Module } from '@nestjs/common';
import {
  CreateProductUseCase,
  GetProductUseCase,
  ListProductsUseCase,
  UpdateProductUseCase,
} from '@hockpay/core';
import { ProductRepository } from '@hockpay/infrastructure';
import { PrismaService } from 'src/infra/database/prisma.service';
import { JwtService } from 'src/infra/services/jwt.service';
import { ApiKeyModule } from '../api-key/api-key.module';
import { AuthModule } from '../auth/auth.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { ProductController } from './product.controller';

@Module({
  imports: [ApiKeyModule, AuthModule],
  controllers: [ProductController],
  providers: [
    CombinedAuthGuard,
    JwtService,
    {
      provide: ProductRepository,
      useFactory: (prisma: PrismaService) => new ProductRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateProductUseCase,
      useFactory: (repo: ProductRepository) => new CreateProductUseCase(repo),
      inject: [ProductRepository],
    },
    {
      provide: ListProductsUseCase,
      useFactory: (repo: ProductRepository) => new ListProductsUseCase(repo),
      inject: [ProductRepository],
    },
    {
      provide: GetProductUseCase,
      useFactory: (repo: ProductRepository) => new GetProductUseCase(repo),
      inject: [ProductRepository],
    },
    {
      provide: UpdateProductUseCase,
      useFactory: (repo: ProductRepository) => new UpdateProductUseCase(repo),
      inject: [ProductRepository],
    },
  ],
  exports: [ProductRepository],
})
export class ProductModule {}
