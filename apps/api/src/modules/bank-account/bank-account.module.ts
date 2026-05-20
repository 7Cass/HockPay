import { Module } from '@nestjs/common';
import { BankAccountController } from './bank-account.controller';
import {
  CreateBankAccountUseCase,
  ListBankAccountsUseCase,
  DeleteBankAccountUseCase,
  SetDefaultBankAccountUseCase,
  GetMerchantUseCase,
  IBankAccountRepository,
  IMerchantRepository,
  IUnitOfWork,
} from '@hockpay/core';
import { BankAccountRepository, UnitOfWork } from '@hockpay/infrastructure';
import { MerchantRepository } from 'src/infra/repositories/merchant.repository.impl';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { JwtService } from 'src/infra/services/jwt.service';

@Module({
  imports: [AuthModule, ApiKeyModule],
  controllers: [BankAccountController],
  providers: [
    PrismaService,
    JwtService,
    {
      provide: 'IBankAccountRepository',
      useFactory: (prisma: PrismaService) => new BankAccountRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IMerchantRepository',
      useFactory: (prisma: PrismaService) => new MerchantRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IUnitOfWork',
      useFactory: (prisma: PrismaService) => new UnitOfWork(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateBankAccountUseCase,
      useFactory: (unitOfWork: IUnitOfWork) =>
        new CreateBankAccountUseCase(unitOfWork),
      inject: ['IUnitOfWork'],
    },
    {
      provide: ListBankAccountsUseCase,
      useFactory: (bankAccountRepo: IBankAccountRepository) =>
        new ListBankAccountsUseCase(bankAccountRepo),
      inject: ['IBankAccountRepository'],
    },
    {
      provide: DeleteBankAccountUseCase,
      useFactory: (bankAccountRepo: IBankAccountRepository) =>
        new DeleteBankAccountUseCase(bankAccountRepo),
      inject: ['IBankAccountRepository'],
    },
    {
      provide: SetDefaultBankAccountUseCase,
      useFactory: (unitOfWork: IUnitOfWork) =>
        new SetDefaultBankAccountUseCase(unitOfWork),
      inject: ['IUnitOfWork'],
    },
    {
      provide: GetMerchantUseCase,
      useFactory: (merchantRepo: IMerchantRepository) =>
        new GetMerchantUseCase(merchantRepo),
      inject: ['IMerchantRepository'],
    },
  ],
})
export class BankAccountModule {}
