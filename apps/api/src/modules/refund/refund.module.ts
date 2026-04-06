import { Module } from '@nestjs/common';
import { RefundController } from './refund.controller';
import {
  CreateRefundUseCase,
  IRefundRepository,
  IPaymentRepository,
  IAccountRepository,
  ITransactionRepository,
  IOutboxWriter,
} from '@hockpay/core';
import {
  RefundRepository,
  PaymentRepository,
  AccountRepository,
  TransactionRepository,
  OutboxRepository,
} from '@hockpay/infrastructure';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { JwtService } from 'src/infra/services/jwt.service';

@Module({
  imports: [AuthModule, ApiKeyModule],
  controllers: [RefundController],
  providers: [
    PrismaService,
    JwtService,
    CombinedAuthGuard,
    {
      provide: 'IRefundRepository',
      useFactory: (prisma: PrismaService) => new RefundRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IPaymentRepository',
      useFactory: (prisma: PrismaService) => new PaymentRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IAccountRepository',
      useFactory: (prisma: PrismaService) => new AccountRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'ITransactionRepository',
      useFactory: (prisma: PrismaService) => new TransactionRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IOutboxWriter',
      useFactory: (prisma: PrismaService) => new OutboxRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateRefundUseCase,
      useFactory: (
        refundRepo: IRefundRepository,
        paymentRepo: IPaymentRepository,
        accountRepo: IAccountRepository,
        transactionRepo: ITransactionRepository,
        outboxWriter: IOutboxWriter,
      ) =>
        new CreateRefundUseCase(
          refundRepo,
          paymentRepo,
          accountRepo,
          transactionRepo,
          outboxWriter,
        ),
      inject: [
        'IRefundRepository',
        'IPaymentRepository',
        'IAccountRepository',
        'ITransactionRepository',
        'IOutboxWriter',
      ],
    },
  ],
  exports: [CreateRefundUseCase, 'IRefundRepository'],
})
export class RefundModule {}
