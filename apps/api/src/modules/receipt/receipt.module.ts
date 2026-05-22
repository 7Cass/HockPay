import { Module } from '@nestjs/common';
import { ReceiptController } from './receipt.controller';
import {
  GetReceiptUseCase,
  ListReceiptsUseCase,
  IReceiptRepository,
} from '@hockpay/core';
import { ReceiptRepository } from '@hockpay/infrastructure';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { JwtService } from 'src/infra/services/jwt.service';

@Module({
  imports: [AuthModule, ApiKeyModule],
  controllers: [ReceiptController],
  providers: [
    JwtService,
    CombinedAuthGuard,
    {
      provide: 'IReceiptRepository',
      useFactory: (prisma: PrismaService) => new ReceiptRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: GetReceiptUseCase,
      useFactory: (repo: IReceiptRepository) => new GetReceiptUseCase(repo),
      inject: ['IReceiptRepository'],
    },
    {
      provide: ListReceiptsUseCase,
      useFactory: (repo: IReceiptRepository) => new ListReceiptsUseCase(repo),
      inject: ['IReceiptRepository'],
    },
  ],
  exports: [GetReceiptUseCase, ListReceiptsUseCase, 'IReceiptRepository'],
})
export class ReceiptModule {}
