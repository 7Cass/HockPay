import { Module } from '@nestjs/common';
import {
  AlertConfigRepository,
  AlertDeliveryLogRepository,
  CreateAlertConfigUseCase,
  DeleteAlertConfigUseCase,
  DiscordAlertSenderService,
  EncryptionService,
  GetAlertConfigUseCase,
  getRequiredEnv,
  IAlertConfigRepository,
  IAlertDeliveryLogRepository,
  import {,
  ListAlertConfigsUseCase,
  ListAlertDeliveryLogsUseCase,
  RetryAlertDeliveryLogUseCase,
  TestAlertConfigUseCase,
  UpdateAlertConfigUseCase,
  } from '@hockpay/core';,
} from '@hockpay/infrastructure';
import { PrismaService } from '../../infra/database/prisma.service';
import { AlertController } from './alert.controller';
import { RequireStoreGuard } from '../auth/guards/require-store.guard';

@Module({
  controllers: [AlertController],
  providers: [
    {
      provide: EncryptionService,
      useFactory: () => new EncryptionService(getRequiredEnv('ENCRYPTION_KEY')),
    },
    DiscordAlertSenderService,
    RequireStoreGuard,
    {
      provide: 'IAlertConfigRepository',
      useFactory: (prisma: PrismaService) => new AlertConfigRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: 'IAlertDeliveryLogRepository',
      useFactory: (prisma: PrismaService) =>
        new AlertDeliveryLogRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateAlertConfigUseCase,
      useFactory: (
        alertConfigRepository: IAlertConfigRepository,
        encryption: EncryptionService,
      ) => new CreateAlertConfigUseCase(alertConfigRepository, encryption),
      inject: ['IAlertConfigRepository', EncryptionService],
    },
    {
      provide: ListAlertConfigsUseCase,
      useFactory: (alertConfigRepository: IAlertConfigRepository) =>
        new ListAlertConfigsUseCase(alertConfigRepository),
      inject: ['IAlertConfigRepository'],
    },
    {
      provide: GetAlertConfigUseCase,
      useFactory: (alertConfigRepository: IAlertConfigRepository) =>
        new GetAlertConfigUseCase(alertConfigRepository),
      inject: ['IAlertConfigRepository'],
    },
    {
      provide: UpdateAlertConfigUseCase,
      useFactory: (
        alertConfigRepository: IAlertConfigRepository,
        encryption: EncryptionService,
      ) => new UpdateAlertConfigUseCase(alertConfigRepository, encryption),
      inject: ['IAlertConfigRepository', EncryptionService],
    },
    {
      provide: DeleteAlertConfigUseCase,
      useFactory: (alertConfigRepository: IAlertConfigRepository) =>
        new DeleteAlertConfigUseCase(alertConfigRepository),
      inject: ['IAlertConfigRepository'],
    },
    {
      provide: TestAlertConfigUseCase,
      useFactory: (
        alertConfigRepository: IAlertConfigRepository,
        alertLogRepository: IAlertDeliveryLogRepository,
        alertSender: DiscordAlertSenderService,
        encryption: EncryptionService,
      ) =>
        new TestAlertConfigUseCase(
          alertConfigRepository,
          alertLogRepository,
          alertSender,
          encryption,
        ),
      inject: [
        'IAlertConfigRepository',
        'IAlertDeliveryLogRepository',
        DiscordAlertSenderService,
        EncryptionService,
      ],
    },
    {
      provide: ListAlertDeliveryLogsUseCase,
      useFactory: (
        alertLogRepository: IAlertDeliveryLogRepository,
        alertConfigRepository: IAlertConfigRepository,
      ) =>
        new ListAlertDeliveryLogsUseCase(
          alertLogRepository,
          alertConfigRepository,
        ),
      inject: ['IAlertDeliveryLogRepository', 'IAlertConfigRepository'],
    },
    {
      provide: RetryAlertDeliveryLogUseCase,
      useFactory: (
        alertLogRepository: IAlertDeliveryLogRepository,
        alertConfigRepository: IAlertConfigRepository,
        alertSender: DiscordAlertSenderService,
        encryption: EncryptionService,
      ) =>
        new RetryAlertDeliveryLogUseCase(
          alertLogRepository,
          alertConfigRepository,
          alertSender,
          encryption,
        ),
      inject: [
        'IAlertDeliveryLogRepository',
        'IAlertConfigRepository',
        DiscordAlertSenderService,
        EncryptionService,
      ],
    },
  ],
})
export class AlertModule {}
