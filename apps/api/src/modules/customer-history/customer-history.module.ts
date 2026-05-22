import { Module } from '@nestjs/common';
import {
  GetCustomerHistoryPaymentUseCase,
  GetCustomerHistoryReceiptUseCase,
  IReceiptRepository,
  IPaymentRepository,
  ListCustomerHistoryPaymentsUseCase,
  ListCustomerHistoryReceiptsUseCase,
} from '@hockpay/core';
import { CustomerRepository } from '@hockpay/infrastructure';
import { CustomerHistoryController } from './customer-history.controller';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { PaymentModule } from '../payment/payment.module';
import { ReceiptModule } from '../receipt/receipt.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { JwtService } from 'src/infra/services/jwt.service';

@Module({
  imports: [AuthModule, ApiKeyModule, PaymentModule, ReceiptModule],
  controllers: [CustomerHistoryController],
  providers: [
    JwtService,
    CombinedAuthGuard,
    {
      provide: CustomerRepository,
      useFactory: (prisma: PrismaService) => new CustomerRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ListCustomerHistoryPaymentsUseCase,
      useFactory: (
        customerRepository: CustomerRepository,
        paymentRepository: IPaymentRepository,
      ) =>
        new ListCustomerHistoryPaymentsUseCase(
          customerRepository,
          paymentRepository,
        ),
      inject: [CustomerRepository, 'IPaymentRepository'],
    },
    {
      provide: GetCustomerHistoryPaymentUseCase,
      useFactory: (
        customerRepository: CustomerRepository,
        paymentRepository: IPaymentRepository,
      ) =>
        new GetCustomerHistoryPaymentUseCase(
          customerRepository,
          paymentRepository,
        ),
      inject: [CustomerRepository, 'IPaymentRepository'],
    },
    {
      provide: ListCustomerHistoryReceiptsUseCase,
      useFactory: (
        customerRepository: CustomerRepository,
        receiptRepository: IReceiptRepository,
      ) =>
        new ListCustomerHistoryReceiptsUseCase(
          customerRepository,
          receiptRepository,
        ),
      inject: [CustomerRepository, 'IReceiptRepository'],
    },
    {
      provide: GetCustomerHistoryReceiptUseCase,
      useFactory: (
        customerRepository: CustomerRepository,
        paymentRepository: IPaymentRepository,
        receiptRepository: IReceiptRepository,
      ) =>
        new GetCustomerHistoryReceiptUseCase(
          customerRepository,
          paymentRepository,
          receiptRepository,
        ),
      inject: [CustomerRepository, 'IPaymentRepository', 'IReceiptRepository'],
    },
  ],
})
export class CustomerHistoryModule {}
