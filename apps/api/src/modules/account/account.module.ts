import { Module } from '@nestjs/common';
import { GetAccountUseCase } from '@hockpay/core';
import { AccountRepository } from '@hockpay/infrastructure';
import { PrismaService } from '../../infra/database/prisma.service';
import { AccountController } from './account.controller';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { JwtService } from '../../infra/services/jwt.service';

@Module({
  imports: [AuthModule, ApiKeyModule],
  controllers: [AccountController],
  providers: [
    JwtService,
    {
      provide: GetAccountUseCase,
      useFactory: (prismaService: PrismaService) => {
        const accountRepo = new AccountRepository(prismaService);
        return new GetAccountUseCase(accountRepo);
      },
      inject: [PrismaService],
    },
  ],
})
export class AccountModule {}
