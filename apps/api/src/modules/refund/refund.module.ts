import { Module } from '@nestjs/common';
import { RefundController } from './refund.controller';
import { CreateRefundUseCase } from '@hockpay/core';
import { provideUseCase } from 'src/common/provide-use-case';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';

/**
 * Refund Module
 *
 * UnitOfWork vem do InfrastructureModule global.
 */
@Module({
  imports: [AuthModule, ApiKeyModule],
  controllers: [RefundController],
  providers: [
    CombinedAuthGuard,
    provideUseCase(CreateRefundUseCase, ['IUnitOfWork']),
  ],
  exports: [CreateRefundUseCase],
})
export class RefundModule {}
