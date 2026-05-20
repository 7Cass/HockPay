import { Module } from '@nestjs/common';
import {
  CancelPaymentLinkUseCase,
  ConfirmPaymentUseCase,
  CreatePaymentLinkUseCase,
  FailPaymentLinkUseCase,
  FeePolicy,
  GetPaymentLinkUseCase,
  IUnitOfWork,
  ListPaymentLinksUseCase,
  OpenPaymentLinkUseCase,
  PayPaymentLinkUseCase,
} from '@hockpay/core';
import {
  PaymentLinkRepository,
  PixChargeRepository,
  StoreRepository,
  UnitOfWork,
} from '@hockpay/infrastructure';
import { PrismaService } from 'src/infra/database/prisma.service';
import { PixQrCodeGeneratorService } from 'src/infra/services/pix-qr-code-generator.service';
import { TokenGeneratorService } from 'src/infra/services/token-generator.service';
import { PaymentModule } from '../payment/payment.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { AuthModule } from '../auth/auth.module';
import { JwtService } from 'src/infra/services/jwt.service';
import { PaymentLinkController } from './payment-link.controller';

@Module({
  imports: [PaymentModule, ApiKeyModule, AuthModule],
  controllers: [PaymentLinkController],
  providers: [
    PrismaService,
    {
      provide: StoreRepository,
      useFactory: (prisma: PrismaService) => new StoreRepository(prisma),
      inject: [PrismaService],
    },
    PixQrCodeGeneratorService,
    TokenGeneratorService,
    JwtService,
    FeePolicy,
    {
      provide: 'IPaymentLinkRepository',
      useFactory: (prisma: PrismaService) =>
        new PaymentLinkRepository(
          prisma,
          process.env.CHECKOUT_BASE_URL ?? 'http://localhost:3333',
        ),
      inject: [PrismaService],
    },
    {
      provide: 'IPixChargeRepository',
      useFactory: (prisma: PrismaService) => new PixChargeRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IUnitOfWorkPaymentLink',
      useFactory: (prisma: PrismaService) => new UnitOfWork(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreatePaymentLinkUseCase,
      useFactory: (
        paymentLinkRepo: any,
        pixChargeRepo: any,
        storeRepo: StoreRepository,
        tokenGenerator: TokenGeneratorService,
        pixGenerator: PixQrCodeGeneratorService,
      ) =>
        new CreatePaymentLinkUseCase(
          paymentLinkRepo,
          pixChargeRepo,
          storeRepo,
          tokenGenerator,
          pixGenerator,
          process.env.CHECKOUT_BASE_URL ?? 'http://localhost:3333',
          process.env.PIX_KEY ?? 'test@hockpay.com',
        ),
      inject: [
        'IPaymentLinkRepository',
        'IPixChargeRepository',
        StoreRepository,
        TokenGeneratorService,
        PixQrCodeGeneratorService,
      ],
    },
    {
      provide: ListPaymentLinksUseCase,
      useFactory: (repo: any) => new ListPaymentLinksUseCase(repo),
      inject: ['IPaymentLinkRepository'],
    },
    {
      provide: GetPaymentLinkUseCase,
      useFactory: (repo: any) => new GetPaymentLinkUseCase(repo),
      inject: ['IPaymentLinkRepository'],
    },
    {
      provide: CancelPaymentLinkUseCase,
      useFactory: (paymentLinkRepo: any, pixChargeRepo: any) =>
        new CancelPaymentLinkUseCase(paymentLinkRepo, pixChargeRepo),
      inject: ['IPaymentLinkRepository', 'IPixChargeRepository'],
    },
    {
      provide: OpenPaymentLinkUseCase,
      useFactory: (paymentLinkRepo: any) =>
        new OpenPaymentLinkUseCase(paymentLinkRepo),
      inject: ['IPaymentLinkRepository'],
    },
    {
      provide: PayPaymentLinkUseCase,
      useFactory: (
        paymentLinkRepo: any,
        unitOfWork: IUnitOfWork,
        feePolicy: FeePolicy,
        confirmUseCase: any,
      ) =>
        new PayPaymentLinkUseCase(
          paymentLinkRepo,
          unitOfWork,
          feePolicy,
          confirmUseCase,
        ),
      inject: [
        'IPaymentLinkRepository',
        'IUnitOfWorkPaymentLink',
        FeePolicy,
        ConfirmPaymentUseCase,
      ],
    },
    {
      provide: FailPaymentLinkUseCase,
      useFactory: (
        paymentLinkRepo: any,
        unitOfWork: IUnitOfWork,
        feePolicy: FeePolicy,
      ) => new FailPaymentLinkUseCase(paymentLinkRepo, unitOfWork, feePolicy),
      inject: ['IPaymentLinkRepository', 'IUnitOfWorkPaymentLink', FeePolicy],
    },
  ],
})
export class PaymentLinkModule {}
