import { Module } from '@nestjs/common';
import { RefundController } from './refund.controller';
import { CreateRefundUseCase, IUnitOfWork } from '@hockpay/core';
import { UnitOfWork } from '@hockpay/infrastructure';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { JwtService } from 'src/infra/services/jwt.service';

@Module({
  imports: [AuthModule, ApiKeyModule],
  controllers: [RefundController],
  providers: [
    JwtService,
    CombinedAuthGuard,
    {
      provide: 'IUnitOfWork',
      useFactory: (prisma: PrismaService) => new UnitOfWork(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateRefundUseCase,
      useFactory: (unitOfWork: IUnitOfWork) =>
        new CreateRefundUseCase(unitOfWork),
      inject: ['IUnitOfWork'],
    },
  ],
  exports: [CreateRefundUseCase],
})
export class RefundModule {}
