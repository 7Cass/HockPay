import { Module } from '@nestjs/common';
import {
  CreateAlertConfigUseCase,
  DeleteAlertConfigUseCase,
  GetAlertConfigUseCase,
  ListAlertConfigsUseCase,
  ListAlertDeliveryLogsUseCase,
  RetryAlertDeliveryLogUseCase,
  TestAlertConfigUseCase,
  UpdateAlertConfigUseCase,
} from '@hockpay/core';
import {
  DiscordAlertSenderService,
  EncryptionService,
} from '@hockpay/infrastructure';
import { provideUseCase } from '../../common/provide-use-case';
import { AlertController } from './alert.controller';
import { RequireStoreGuard } from '../auth/guards/require-store.guard';

/**
 * Alert Module
 *
 * Repositorios, EncryptionService e DiscordAlertSenderService vem do
 * InfrastructureModule global.
 */
@Module({
  controllers: [AlertController],
  providers: [
    RequireStoreGuard,

    provideUseCase(CreateAlertConfigUseCase, [
      'IAlertConfigRepository',
      EncryptionService,
    ]),
    provideUseCase(ListAlertConfigsUseCase, ['IAlertConfigRepository']),
    provideUseCase(GetAlertConfigUseCase, ['IAlertConfigRepository']),
    provideUseCase(UpdateAlertConfigUseCase, [
      'IAlertConfigRepository',
      EncryptionService,
    ]),
    provideUseCase(DeleteAlertConfigUseCase, ['IAlertConfigRepository']),
    provideUseCase(TestAlertConfigUseCase, [
      'IAlertConfigRepository',
      'IAlertDeliveryLogRepository',
      DiscordAlertSenderService,
      EncryptionService,
    ]),
    provideUseCase(ListAlertDeliveryLogsUseCase, [
      'IAlertDeliveryLogRepository',
      'IAlertConfigRepository',
    ]),
    provideUseCase(RetryAlertDeliveryLogUseCase, [
      'IAlertDeliveryLogRepository',
      'IAlertConfigRepository',
      DiscordAlertSenderService,
      EncryptionService,
    ]),
  ],
})
export class AlertModule {}
