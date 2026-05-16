import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import {
  GetDashboardOverviewUseCase,
  GetDashboardMetricsUseCase,
  IDashboardOverviewRepository,
  ITransactionRepository,
  IAccountRepository,
} from '@hockpay/core';
import {
  AccountRepository,
  DashboardOverviewRepository,
  TransactionRepository,
} from '@hockpay/infrastructure';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { JwtService } from 'src/infra/services/jwt.service';

/**
 * Dashboard Module
 *
 * Provides metrics and aggregation endpoints for the overview page.
 */
@Module({
  imports: [AuthModule, ApiKeyModule],
  controllers: [DashboardController],
  providers: [
    PrismaService,
    JwtService,
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
      provide: 'IDashboardOverviewRepository',
      useFactory: (prisma: PrismaService) =>
        new DashboardOverviewRepository(prisma),
      inject: [PrismaService],
    },
    CombinedAuthGuard,
    {
      provide: GetDashboardMetricsUseCase,
      useFactory: (
        transactionRepo: ITransactionRepository,
        accountRepo: IAccountRepository,
      ) => {
        return new GetDashboardMetricsUseCase(transactionRepo, accountRepo);
      },
      inject: ['ITransactionRepository', 'IAccountRepository'],
    },
    {
      provide: GetDashboardOverviewUseCase,
      useFactory: (dashboardOverviewRepo: IDashboardOverviewRepository) => {
        return new GetDashboardOverviewUseCase(dashboardOverviewRepo);
      },
      inject: ['IDashboardOverviewRepository'],
    },
  ],
})
export class DashboardModule {}
