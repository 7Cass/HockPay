import { Module } from '@nestjs/common';
import { MerchantController } from './merchant.controller';
import {
  CreateMerchantUseCase,
  GetMerchantUseCase,
  GetCurrentMerchantUseCase,
} from '@hockpay/core';
import { MerchantRepository } from '@hockpay/infrastructure';
import { PasswordHasherService } from 'src/infra/services/password-hasher.service';
import { provideUseCase } from 'src/common/provide-use-case';

/**
 * Merchant Module
 *
 * This module provides the merchant-related endpoints and dependencies.
 * Use cases from the core layer are instantiated here with their dependencies.
 *
 * MerchantRepository vem do InfrastructureModule global.
 */
@Module({
  imports: [],
  controllers: [MerchantController],
  providers: [
    PasswordHasherService,

    provideUseCase(CreateMerchantUseCase, [
      MerchantRepository,
      PasswordHasherService,
    ]),
    provideUseCase(GetMerchantUseCase, [MerchantRepository]),
    provideUseCase(GetCurrentMerchantUseCase, [MerchantRepository]),
  ],
  exports: [
    CreateMerchantUseCase,
    GetMerchantUseCase,
    GetCurrentMerchantUseCase,
  ],
})
export class MerchantModule {}
