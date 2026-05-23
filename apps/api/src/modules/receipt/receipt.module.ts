import { Module } from '@nestjs/common';
import { ReceiptController } from './receipt.controller';
import {
  GetReceiptUseCase,
  IPaymentRepository,
  ListReceiptsUseCase,
  IReceiptRepository,
} from '@hockpay/core';
import { ReceiptRepository } from '@hockpay/infrastructure';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { JwtService } from 'src/infra/services/jwt.service';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [AuthModule, ApiKeyModule, PaymentModule],
  controllers: [ReceiptController],
  providers: [
    JwtService,
    CombinedAuthGuard,
    {
      provide: 'IReceiptRepository',
      useFactory: (prisma: PrismaService) => new ReceiptRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: GetReceiptUseCase,
      useFactory: (repo: IReceiptRepository, paymentRepo: IPaymentRepository) =>
        new GetReceiptUseCase(repo, paymentRepo),
      inject: ['IReceiptRepository', 'IPaymentRepository'],
    },
    {
      provide: ListReceiptsUseCase,
      useFactory: (repo: IReceiptRepository, paymentRepo: IPaymentRepository) =>
        new ListReceiptsUseCase(repo, paymentRepo),
      inject: ['IReceiptRepository', 'IPaymentRepository'],
    },
  ],
  exports: [GetReceiptUseCase, ListReceiptsUseCase, 'IReceiptRepository'],
})
export class ReceiptModule {}
