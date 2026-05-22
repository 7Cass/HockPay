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
import { PrismaService } from 'src/infra/database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { JwtService } from 'src/infra/services/jwt.service';

/**
 * Customer Module
 *
 * This module provides customer-related endpoints and dependencies.
 * Use cases from the core layer are instantiated here with their dependencies.
 *
 * Dependencies:
 * - ApiKeyModule: Provides ValidateApiKeyUseCase for CombinedAuthGuard
 */
@Module({
  imports: [AuthModule, ApiKeyModule], // ApiKeyModule provides ValidateApiKeyUseCase
  controllers: [CustomerController],
  providers: [
    // Infrastructure
    {
      provide: CustomerRepository,
      useFactory: (prisma: PrismaService) => new CustomerRepository(prisma),
      inject: [PrismaService],
    },
    JwtService,

    // CombinedAuthGuard (uses ValidateApiKeyUseCase from ApiKeyModule)
    CombinedAuthGuard,

    // Use Cases (from core) - CreateCustomerUseCase
    {
      provide: CreateCustomerUseCase,
      useFactory: (repo: CustomerRepository) => {
        return new CreateCustomerUseCase(repo);
      },
      inject: [CustomerRepository],
    },

    // ListCustomersUseCase
    {
      provide: ListCustomersUseCase,
      useFactory: (repo: CustomerRepository) => {
        return new ListCustomersUseCase(repo);
      },
      inject: [CustomerRepository],
    },

    // GetCustomerUseCase
    {
      provide: GetCustomerUseCase,
      useFactory: (repo: CustomerRepository) => {
        return new GetCustomerUseCase(repo);
      },
      inject: [CustomerRepository],
    },

    // GetCustomerByIdUseCase
    {
      provide: GetCustomerByIdUseCase,
      useFactory: (repo: CustomerRepository) => {
        return new GetCustomerByIdUseCase(repo);
      },
      inject: [CustomerRepository],
    },

    // UpdateCustomerUseCase
    {
      provide: UpdateCustomerUseCase,
      useFactory: (repo: CustomerRepository) => {
        return new UpdateCustomerUseCase(repo);
      },
      inject: [CustomerRepository],
    },
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
