import {
  CreateWebhookConfigUseCase,
  CreateWebhookInboxUseCase,
  DeleteWebhookConfigUseCase,
  GetWebhookConfigUseCase,
  ListWebhookConfigsUseCase,
  ListWebhookInboxEventsUseCase,
  ListWebhookLogsUseCase,
  RetryWebhookLogUseCase,
  TestWebhookConfigUseCase,
  UpdateWebhookConfigUseCase,
} from '@hockpay/core';
import { WebhookController } from './webhook.controller';

describe('WebhookController', () => {
  let controller: WebhookController;
  let retryWebhookLogUseCase: { execute: jest.Mock };

  beforeEach(() => {
    retryWebhookLogUseCase = {
      execute: jest.fn().mockResolvedValue({
        success: true,
        statusCode: 204,
        responseBody: 'ok',
        log: {
          toObject: () => ({
            id: 'log-1',
            configId: 'config-route',
            eventType: 'payment.created',
            payload: { id: 'payment-1' },
            status: 'DELIVERED',
            attempt: 2,
            maxAttempts: 5,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
        },
      }),
    };

    controller = new WebhookController(
      { execute: jest.fn() } as unknown as CreateWebhookConfigUseCase,
      { execute: jest.fn() } as unknown as CreateWebhookInboxUseCase,
      { execute: jest.fn() } as unknown as ListWebhookConfigsUseCase,
      { execute: jest.fn() } as unknown as GetWebhookConfigUseCase,
      { execute: jest.fn() } as unknown as UpdateWebhookConfigUseCase,
      { execute: jest.fn() } as unknown as DeleteWebhookConfigUseCase,
      { execute: jest.fn() } as unknown as TestWebhookConfigUseCase,
      { execute: jest.fn() } as unknown as ListWebhookLogsUseCase,
      { execute: jest.fn() } as unknown as ListWebhookInboxEventsUseCase,
      retryWebhookLogUseCase as unknown as RetryWebhookLogUseCase,
    );
  });

  it('forwards the route webhook config id when retrying a log', async () => {
    await controller.retryLog('config-route', 'log-1', {
      store: { id: 'store-1' },
      id: 'req-1',
    } as any);

    expect(retryWebhookLogUseCase.execute).toHaveBeenCalledWith({
      configId: 'config-route',
      logId: 'log-1',
      storeId: 'store-1',
      requestId: 'req-1',
    });
  });
});
