import { Module } from '@nestjs/common';
import {
  CompleteWithdrawalUseCase,
  CreateWithdrawalUseCase,
  FailWithdrawalUseCase,
  GetWithdrawalUseCase,
  IAccountRepository,
  IUnitOfWork,
  IWithdrawalRepository,
  ListWithdrawalsUseCase,
  WithdrawalPolicy,
} from '@hockpay/core';
import {
  AccountRepository,
  UnitOfWork,
  WithdrawalRepository,
} from '@hockpay/infrastructure';
import { PrismaService } from 'src/infra/database/prisma.service';
import { JwtService } from 'src/infra/services/jwt.service';
import { ApiKeyModule } from '../api-key/api-key.module';
import { AuthModule } from '../auth/auth.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { WithdrawalController } from './withdrawal.controller';
import { WithdrawalDevController } from './withdrawal-dev.controller';

@Module({
  imports: [AuthModule, ApiKeyModule],
  controllers: [WithdrawalController, WithdrawalDevController],
  providers: [
    PrismaService,
    JwtService,
    CombinedAuthGuard,
    WithdrawalPolicy,
    {
      provide: 'IUnitOfWork',
      useFactory: (prisma: PrismaService) => new UnitOfWork(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IWithdrawalRepository',
      useFactory: (prisma: PrismaService) => new WithdrawalRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IAccountRepository',
      useFactory: (prisma: PrismaService) => new AccountRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateWithdrawalUseCase,
      useFactory: (unitOfWork: IUnitOfWork, policy: WithdrawalPolicy) =>
        new CreateWithdrawalUseCase(unitOfWork, policy),
      inject: ['IUnitOfWork', WithdrawalPolicy],
    },
    {
      provide: ListWithdrawalsUseCase,
      useFactory: (
        withdrawalRepository: IWithdrawalRepository,
        accountRepository: IAccountRepository,
      ) => new ListWithdrawalsUseCase(withdrawalRepository, accountRepository),
      inject: ['IWithdrawalRepository', 'IAccountRepository'],
    },
    {
      provide: GetWithdrawalUseCase,
      useFactory: (unitOfWork: IUnitOfWork) =>
        new GetWithdrawalUseCase(unitOfWork),
      inject: ['IUnitOfWork'],
    },
    {
      provide: CompleteWithdrawalUseCase,
      useFactory: (unitOfWork: IUnitOfWork) =>
        new CompleteWithdrawalUseCase(unitOfWork),
      inject: ['IUnitOfWork'],
    },
    {
      provide: FailWithdrawalUseCase,
      useFactory: (unitOfWork: IUnitOfWork) =>
        new FailWithdrawalUseCase(unitOfWork),
      inject: ['IUnitOfWork'],
    },
  ],
})
export class WithdrawalModule {}
