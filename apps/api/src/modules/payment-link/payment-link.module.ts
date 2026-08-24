import { Module } from '@nestjs/common';
import {
  CancelPaymentLinkUseCase,
  CreatePaymentLinkUseCase,
  FailPaymentLinkUseCase,
  FeePolicy,
  GetPaymentLinkUseCase,
  IPaymentLinkRepository,
  IPixChargeRepository,
  IUnitOfWork,
  ITokenGeneratorPort,
  IPixQrCodeGeneratorPort,
  ListPaymentLinksUseCase,
  OpenPaymentLinkUseCase,
  PayPaymentLinkUseCase,
} from '@hockpay/core';
import { StoreRepository } from '@hockpay/infrastructure';
import { PixQrCodeGeneratorService } from 'src/infra/services/pix-qr-code-generator.service';
import { TokenGeneratorService } from 'src/infra/services/token-generator.service';
import { provideUseCase } from 'src/common/provide-use-case';
import { PaymentModule } from '../payment/payment.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentLinkController } from './payment-link.controller';

/**
 * Payment Link Module
 *
 * Repositorios e adapters vem do InfrastructureModule global.
 */
@Module({
  imports: [PaymentModule, ApiKeyModule, AuthModule],
  controllers: [PaymentLinkController],
  providers: [
    FeePolicy,

    {
      // Nao usa `provideUseCase`: este construtor recebe a configuracao no
      // meio da lista (checkoutBaseUrl e pixKey vem antes de unitOfWork),
      // enquanto o helper anexa `extraArgs` sempre no fim.
      provide: CreatePaymentLinkUseCase,
      useFactory: (
        paymentLinkRepo: IPaymentLinkRepository,
        pixChargeRepo: IPixChargeRepository,
        storeRepo: StoreRepository,
        tokenGenerator: ITokenGeneratorPort,
        pixGenerator: IPixQrCodeGeneratorPort,
        unitOfWork: IUnitOfWork,
      ) =>
        new CreatePaymentLinkUseCase(
          paymentLinkRepo,
          pixChargeRepo,
          storeRepo,
          tokenGenerator,
          pixGenerator,
          process.env.CHECKOUT_BASE_URL ?? 'http://localhost:3333',
          process.env.PIX_KEY ?? 'test@hockpay.com',
          unitOfWork,
        ),
      inject: [
        'IPaymentLinkRepository',
        'IPixChargeRepository',
        StoreRepository,
        TokenGeneratorService,
        PixQrCodeGeneratorService,
        'IUnitOfWork',
      ],
    },
    provideUseCase(ListPaymentLinksUseCase, ['IPaymentLinkRepository']),
    provideUseCase(GetPaymentLinkUseCase, ['IPaymentLinkRepository']),
    provideUseCase(CancelPaymentLinkUseCase, [
      'IPaymentLinkRepository',
      'IPixChargeRepository',
      'IUnitOfWork',
    ]),
    provideUseCase(OpenPaymentLinkUseCase, ['IPaymentLinkRepository']),
    provideUseCase(PayPaymentLinkUseCase, [
      'IPaymentLinkRepository',
      'IUnitOfWork',
      FeePolicy,
    ]),
    provideUseCase(FailPaymentLinkUseCase, [
      'IPaymentLinkRepository',
      'IUnitOfWork',
      FeePolicy,
    ]),
  ],
})
export class PaymentLinkModule {}
