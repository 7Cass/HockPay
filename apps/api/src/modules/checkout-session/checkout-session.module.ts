import { Module } from '@nestjs/common';
import { CheckoutSessionController } from './checkout-session.controller';
import {
  CreateCheckoutSessionUseCase,
  GetCheckoutSessionUseCase,
  FulfillCheckoutSessionUseCase,
  IUnitOfWork,
} from '@hockpay/core';
import {
  CheckoutSessionRepository,
  StoreRepository,
  UnitOfWork,
} from '@hockpay/infrastructure';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TokenGeneratorService } from 'src/infra/services/token-generator.service';
import { PaymentModule } from '../payment/payment.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { AuthModule } from '../auth/auth.module';
import { CreatePaymentUseCase } from '@hockpay/core';
import { JwtService } from 'src/infra/services/jwt.service';

@Module({
  imports: [PaymentModule, ApiKeyModule, AuthModule],
  controllers: [CheckoutSessionController],
  providers: [
    {
      provide: StoreRepository,
      useFactory: (prisma: PrismaService) => new StoreRepository(prisma),
      inject: [PrismaService],
    },
    TokenGeneratorService,
    JwtService,
    {
      provide: 'ICheckoutSessionRepository',
      useFactory: (prisma: PrismaService) =>
        new CheckoutSessionRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IUnitOfWork',
      useFactory: (prisma: PrismaService) => new UnitOfWork(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateCheckoutSessionUseCase,
      useFactory: (sessionRepo: any, storeRepo: any, tokenGenerator: any) => {
        return new CreateCheckoutSessionUseCase(
          sessionRepo,
          storeRepo,
          tokenGenerator,
          process.env.CHECKOUT_BASE_URL ?? 'http://localhost:3333',
        );
      },
      inject: [
        'ICheckoutSessionRepository',
        StoreRepository,
        TokenGeneratorService,
      ],
    },
    {
      provide: GetCheckoutSessionUseCase,
      useFactory: (sessionRepo: any, storeRepo: any, paymentRepo: any) => {
        return new GetCheckoutSessionUseCase(
          sessionRepo,
          storeRepo,
          paymentRepo,
        );
      },
      inject: [
        'ICheckoutSessionRepository',
        StoreRepository,
        'IPaymentRepository',
      ],
    },
    {
      provide: FulfillCheckoutSessionUseCase,
      useFactory: (
        unitOfWork: IUnitOfWork,
        createPaymentUseCase: CreatePaymentUseCase,
      ) => {
        return new FulfillCheckoutSessionUseCase(
          unitOfWork,
          createPaymentUseCase,
        );
      },
      inject: ['IUnitOfWork', CreatePaymentUseCase],
    },
  ],
})
export class CheckoutSessionModule {}
