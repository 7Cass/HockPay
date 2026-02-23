import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infra/database/prisma.module';
import { MerchantModule } from './modules/merchant/merchant.module';
import { AuthModule } from './modules/auth/auth.module';
import { ApiKeyModule } from './modules/api-key/api-key.module';
import { StoreModule } from './modules/store/store.module';
import { CustomerModule } from './modules/customer/customer.module';
import { PaymentModule } from './modules/payment/payment.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env', '../../.env'],
      isGlobal: true,
    }),
    PrismaModule,
    MerchantModule,
    AuthModule,
    ApiKeyModule,
    StoreModule,
    CustomerModule,
    PaymentModule,
    WebhookModule,
    IdempotencyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global JWT Authentication Guard
    // All routes are protected by default. Use @Public() decorator to make routes public.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Idempotency Interceptor
    // Handles Idempotency-Key header for safe request retries
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule {}
