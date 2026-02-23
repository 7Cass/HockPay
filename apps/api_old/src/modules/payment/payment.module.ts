import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { PrismaModule } from '../../infra/database/prisma.module';
import {
  PaymentRepository,
  StoreRepository,
  CustomerRepository,
  WebhookRepository,
} from '../../infra/repositories/prisma';
import { QrCodePixGeneratorService } from '../../infra/services/pix-generator.service';
import { PaymentService } from './payment.service';
import { PaymentController, DevController } from './controllers';

/**
 * PaymentModule
 *
 * Módulo que gerencia pagamentos Pix
 */
@Module({
  imports: [PrismaModule],
  controllers: [PaymentController, DevController],
  providers: [
    // Repositories
    PaymentRepository,
    StoreRepository,
    CustomerRepository,
    WebhookRepository,
    // Services
    QrCodePixGeneratorService,
    // PaymentService (consolidado, substitui use cases)
    PaymentService,
    // Guards
    ApiKeyGuard,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
