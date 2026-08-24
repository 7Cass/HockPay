import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StoreController } from './store.controller';
import {
  CreateStoreUseCase,
  ListStoresUseCase,
  UpdateStoreProfileUseCase,
} from '@hockpay/core';
import { StoreRepository } from '@hockpay/infrastructure';
import { JwtService } from 'src/infra/services/jwt.service';
import { TokenGeneratorService } from 'src/infra/services/token-generator.service';
import { SlugGeneratorService } from 'src/infra/services/slug-generator.service';
import { provideUseCase } from 'src/common/provide-use-case';
import { AuthModule } from '../auth/auth.module';

/**
 * Store Module
 *
 * This module provides store-related endpoints and dependencies.
 * Use cases from the core layer are instantiated here with their dependencies.
 *
 * StoreRepository, UnitOfWork, JwtService e TokenGeneratorService vem do
 * InfrastructureModule global.
 */
@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [StoreController],
  providers: [
    SlugGeneratorService,

    provideUseCase(CreateStoreUseCase, [
      'IUnitOfWork',
      JwtService,
      TokenGeneratorService,
      SlugGeneratorService,
    ]),
    provideUseCase(ListStoresUseCase, [StoreRepository]),
    provideUseCase(UpdateStoreProfileUseCase, [StoreRepository]),
  ],
  exports: [CreateStoreUseCase, ListStoresUseCase, UpdateStoreProfileUseCase],
})
export class StoreModule {}
