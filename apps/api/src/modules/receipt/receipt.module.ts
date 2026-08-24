import { Module } from '@nestjs/common';
import { ReceiptController } from './receipt.controller';
import { GetReceiptUseCase, ListReceiptsUseCase } from '@hockpay/core';
import { provideUseCase } from 'src/common/provide-use-case';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { PaymentModule } from '../payment/payment.module';

/**
 * Receipt Module
 *
 * Repositorios vem do InfrastructureModule global.
 */
@Module({
  imports: [AuthModule, ApiKeyModule, PaymentModule],
  controllers: [ReceiptController],
  providers: [
    CombinedAuthGuard,

    provideUseCase(GetReceiptUseCase, [
      'IReceiptRepository',
      'IPaymentRepository',
    ]),
    provideUseCase(ListReceiptsUseCase, [
      'IReceiptRepository',
      'IPaymentRepository',
    ]),
  ],
  exports: [GetReceiptUseCase, ListReceiptsUseCase],
})
export class ReceiptModule {}
