import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import {
    ListTransactionsUseCase,
    ITransactionRepository,
    IAccountRepository,
} from '@hockpay/core';
import { TransactionRepository, AccountRepository } from '@hockpay/infrastructure';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { JwtService } from 'src/infra/services/jwt.service';

/**
 * Transaction Module
 * 
 * Provides endpoints for retrieving transaction ledgers.
 */
@Module({
    imports: [AuthModule, ApiKeyModule],
    controllers: [TransactionController],
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
        CombinedAuthGuard,
        {
            provide: ListTransactionsUseCase,
            useFactory: (
                transactionRepo: ITransactionRepository,
                accountRepo: IAccountRepository,
            ) => {
                return new ListTransactionsUseCase(transactionRepo, accountRepo);
            },
            inject: ['ITransactionRepository', 'IAccountRepository'],
        },
    ],
})
export class TransactionModule { }
