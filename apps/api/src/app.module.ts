import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { PrismaModule } from './infra/database/prisma.module';
import { MerchantModule } from './modules/merchant/merchant.module';
import { AuthModule } from './modules/auth/auth.module';
import { ApiKeyModule } from './modules/api-key/api-key.module';
import { StoreModule } from './modules/store/store.module';
import { CustomerModule } from './modules/customer/customer.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ProductModule } from './modules/product/product.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { AccountModule } from './modules/account/account.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { BankAccountModule } from './modules/bank-account/bank-account.module';
import { CheckoutSessionModule } from './modules/checkout-session/checkout-session.module';
import { HealthModule } from './modules/health/health.module';
import { ReceiptModule } from './modules/receipt/receipt.module';
import { RefundModule } from './modules/refund/refund.module';
import { CustomerHistoryModule } from './modules/customer-history/customer-history.module';
import { AlertModule } from './modules/alert/alert.module';
import { PaymentLinkModule } from './modules/payment-link/payment-link.module';
import { WithdrawalModule } from './modules/withdrawal/withdrawal.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { randomUUID } from 'crypto';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env', '../../.env'],
      isGlobal: true,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level: isProd ? 'info' : 'debug',
            // Gerar ID de requisição se não vier no header
            genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
            transport: isProd ? undefined : { target: 'pino-pretty' },
            customProps: (req, res) => ({
              context: 'HTTP',
            }),
            // Serializadores para não vazar dados sensíveis
            serializers: {
              req: (req) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
            },
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000,
            limit: 100,
          },
        ],
        storage: new ThrottlerStorageRedisService({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        }),
      }),
    }),
    PrismaModule,
    MerchantModule,
    AuthModule,
    ApiKeyModule,
    StoreModule,
    CustomerModule,
    ProductModule,
    PaymentModule,
    WebhookModule,
    IdempotencyModule,
    AccountModule,
    TransactionModule,
    DashboardModule,
    BankAccountModule,
    CheckoutSessionModule,
    HealthModule,
    ReceiptModule,
    RefundModule,
    CustomerHistoryModule,
    AlertModule,
    PaymentLinkModule,
    WithdrawalModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule {}
