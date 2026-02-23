import { Module } from '@nestjs/common';
import { MerchantController } from './merchant.controller';
import { CreateMerchantUseCase, GetMerchantUseCase } from '@hockpay/core';
import { MerchantRepository } from 'src/infra/repositories/merchant.repository.impl';
import { PasswordHasherService } from 'src/infra/services/password-hasher.service';
import { PrismaService } from 'src/infra/database/prisma.service';

/**
 * Merchant Module
 *
 * This module provides the merchant-related endpoints and dependencies.
 * Use cases from the core layer are instantiated here with their dependencies.
 */
@Module({
  imports: [],
  controllers: [MerchantController],
  providers: [
    // Infrastructure
    PrismaService,
    MerchantRepository,
    PasswordHasherService,

    // Use Cases (from core)
    {
      provide: CreateMerchantUseCase,
      useFactory: (repo: MerchantRepository, hasher: PasswordHasherService) => {
        return new CreateMerchantUseCase(repo, hasher);
      },
      inject: [MerchantRepository, PasswordHasherService],
    },
    {
      provide: GetMerchantUseCase,
      useFactory: (repo: MerchantRepository) => {
        return new GetMerchantUseCase(repo);
      },
      inject: [MerchantRepository],
    },
  ],
  exports: [CreateMerchantUseCase, GetMerchantUseCase],
})
export class MerchantModule {}
