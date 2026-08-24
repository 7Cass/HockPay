import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import {
  CreateCustomerUseCase,
  GetCustomerByIdUseCase,
  ListCustomersUseCase,
  GetCustomerUseCase,
  UpdateCustomerUseCase,
} from '@hockpay/core';
import { CustomerRepository } from '@hockpay/infrastructure';
import { provideUseCase } from 'src/common/provide-use-case';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';

/**
 * Customer Module
 *
 * This module provides customer-related endpoints and dependencies.
 * Use cases from the core layer are instantiated here with their dependencies.
 *
 * CustomerRepository vem do InfrastructureModule global.
 *
 * Dependencies:
 * - ApiKeyModule: Provides ValidateApiKeyUseCase for CombinedAuthGuard
 */
@Module({
  imports: [AuthModule, ApiKeyModule], // ApiKeyModule provides ValidateApiKeyUseCase
  controllers: [CustomerController],
  providers: [
    CombinedAuthGuard,

    provideUseCase(CreateCustomerUseCase, [CustomerRepository]),
    provideUseCase(ListCustomersUseCase, [CustomerRepository]),
    provideUseCase(GetCustomerUseCase, [CustomerRepository]),
    provideUseCase(GetCustomerByIdUseCase, [CustomerRepository]),
    provideUseCase(UpdateCustomerUseCase, [CustomerRepository]),
  ],
  exports: [
    CreateCustomerUseCase,
    ListCustomersUseCase,
    GetCustomerUseCase,
    GetCustomerByIdUseCase,
    UpdateCustomerUseCase,
  ],
})
export class CustomerModule {}
