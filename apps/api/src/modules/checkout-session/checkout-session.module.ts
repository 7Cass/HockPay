import { Module } from '@nestjs/common';
import { CheckoutSessionController } from './checkout-session.controller';
import {
  CreateCheckoutSessionUseCase,
  CreatePaymentUseCase,
  GetCheckoutSessionUseCase,
  FulfillCheckoutSessionUseCase,
  LineItemResolverService,
} from '@hockpay/core';
import { ProductRepository, StoreRepository } from '@hockpay/infrastructure';
import { TokenGeneratorService } from 'src/infra/services/token-generator.service';
import { provideUseCase } from 'src/common/provide-use-case';
import { PaymentModule } from '../payment/payment.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Checkout Session Module
 *
 * Repositorios e adapters vem do InfrastructureModule global.
 */
@Module({
  imports: [PaymentModule, ApiKeyModule, AuthModule],
  controllers: [CheckoutSessionController],
  providers: [
    {
      provide: LineItemResolverService,
      useFactory: (productRepo: ProductRepository) =>
        new LineItemResolverService(productRepo),
      inject: [ProductRepository],
    },

    provideUseCase(
      CreateCheckoutSessionUseCase,
      ['IUnitOfWork', TokenGeneratorService],
      () => [process.env.CHECKOUT_BASE_URL ?? 'http://localhost:3333'],
    ),
    provideUseCase(GetCheckoutSessionUseCase, [
      'ICheckoutSessionRepository',
      StoreRepository,
      'IPaymentRepository',
    ]),
    provideUseCase(FulfillCheckoutSessionUseCase, [
      'IUnitOfWork',
      CreatePaymentUseCase,
    ]),
  ],
})
export class CheckoutSessionModule {}
