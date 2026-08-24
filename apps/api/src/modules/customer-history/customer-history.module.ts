import { Module } from '@nestjs/common';
import {
  GetCustomerHistoryPaymentUseCase,
  GetCustomerHistoryReceiptUseCase,
  ListCustomerHistoryPaymentsUseCase,
  ListCustomerHistoryReceiptsUseCase,
} from '@hockpay/core';
import { CustomerRepository } from '@hockpay/infrastructure';
import { CustomerHistoryController } from './customer-history.controller';
import { provideUseCase } from 'src/common/provide-use-case';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { PaymentModule } from '../payment/payment.module';
import { ReceiptModule } from '../receipt/receipt.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';

/**
 * Customer History Module
 *
 * Repositorios vem do InfrastructureModule global.
 */
@Module({
  imports: [AuthModule, ApiKeyModule, PaymentModule, ReceiptModule],
  controllers: [CustomerHistoryController],
  providers: [
    CombinedAuthGuard,

    provideUseCase(ListCustomerHistoryPaymentsUseCase, [
      CustomerRepository,
      'IPaymentRepository',
    ]),
    provideUseCase(GetCustomerHistoryPaymentUseCase, [
      CustomerRepository,
      'IPaymentRepository',
    ]),
    provideUseCase(ListCustomerHistoryReceiptsUseCase, [
      CustomerRepository,
      'IReceiptRepository',
    ]),
    provideUseCase(GetCustomerHistoryReceiptUseCase, [
      CustomerRepository,
      'IPaymentRepository',
      'IReceiptRepository',
    ]),
  ],
})
export class CustomerHistoryModule {}
