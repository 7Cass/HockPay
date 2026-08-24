import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import {
  GetDashboardOverviewUseCase,
  GetDashboardMetricsUseCase,
} from '@hockpay/core';
import { provideUseCase } from 'src/common/provide-use-case';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';

/**
 * Dashboard Module
 *
 * Provides metrics and aggregation endpoints for the overview page.
 *
 * Repositorios vem do InfrastructureModule global.
 */
@Module({
  imports: [AuthModule, ApiKeyModule],
  controllers: [DashboardController],
  providers: [
    CombinedAuthGuard,

    provideUseCase(GetDashboardMetricsUseCase, [
      'ITransactionRepository',
      'IAccountRepository',
    ]),
    provideUseCase(GetDashboardOverviewUseCase, [
      'IDashboardOverviewRepository',
    ]),
  ],
})
export class DashboardModule {}
