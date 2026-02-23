import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StoreController } from './store.controller';
import { CreateStoreUseCase, ListStoresUseCase } from '@hockpay/core';
import { MerchantRepository } from 'src/infra/repositories/merchant.repository.impl';
import { RefreshTokenRepository } from 'src/infra/repositories/refresh-token.repository.impl';
import { StoreRepository } from 'src/infra/repositories/store.repository.impl';
import { JwtService } from 'src/infra/services/jwt.service';
import { TokenGeneratorService } from 'src/infra/services/token-generator.service';
import { SlugGeneratorService } from 'src/infra/services/slug-generator.service';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AuthModule } from '../auth/auth.module';

/**
 * Store Module
 *
 * This module provides store-related endpoints and dependencies.
 * Use cases from the core layer are instantiated here with their dependencies.
 */
@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [StoreController],
  providers: [
    // Infrastructure
    PrismaService,
    MerchantRepository,
    RefreshTokenRepository,
    StoreRepository,
    JwtService,
    TokenGeneratorService,
    SlugGeneratorService,

    // Use Cases (from core)
    {
      provide: CreateStoreUseCase,
      useFactory: (
        storeRepo: StoreRepository,
        merchantRepo: MerchantRepository,
        jwtService: JwtService,
        refreshTokenRepo: RefreshTokenRepository,
        tokenGenerator: TokenGeneratorService,
        slugGenerator: SlugGeneratorService,
      ) => {
        return new CreateStoreUseCase(
          storeRepo,
          merchantRepo,
          jwtService,
          refreshTokenRepo,
          tokenGenerator,
          slugGenerator,
        );
      },
      inject: [
        StoreRepository,
        MerchantRepository,
        JwtService,
        RefreshTokenRepository,
        TokenGeneratorService,
        SlugGeneratorService,
      ],
    },
    {
      provide: ListStoresUseCase,
      useFactory: (storeRepo: StoreRepository) => {
        return new ListStoresUseCase(storeRepo);
      },
      inject: [StoreRepository],
    },
  ],
  exports: [CreateStoreUseCase, ListStoresUseCase],
})
export class StoreModule {}
