import { describe, expect, it, vi } from 'vitest';
import { WebhookConfig } from '../../domain/entities/webhook-config.entity';
import { WebhookLog } from '../../domain/entities/webhook-log.entity';
import { WebhookConfigNotFoundError } from '../../domain/errors/webhook-config-not-found.error';
import { ListWebhookLogsUseCase } from './list-webhook-logs.use-case';

describe('ListWebhookLogsUseCase', () => {
  function makeConfig(storeId = 'store-1') {
    return WebhookConfig.reconstitute({
      id: 'config-1',
      storeId,
      url: 'https://example.com/webhook',
      secret: 'secret',
      prefix: 'whsec_test',
      events: ['payment.created'],
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  }

  function makeLog(id: string) {
    return WebhookLog.reconstitute({
      id,
      configId: 'config-1',
      paymentId: 'payment-1',
      eventType: 'payment.created',
      payload: {},
      attempt: 1,
      maxAttempts: 5,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  }

  function makeUseCase(config: WebhookConfig | null, logs = [makeLog('log-1')], total = 9) {
    const webhookLogRepository = {
      findByConfigId: vi.fn().mockResolvedValue(logs),
      countByConfigId: vi.fn().mockResolvedValue(total),
    };
    const webhookConfigRepository = {
      findById: vi.fn().mockResolvedValue(config),
    };

    return {
      useCase: new ListWebhookLogsUseCase(
        webhookLogRepository as any,
        webhookConfigRepository as any,
      ),
      webhookLogRepository,
    };
  }

  it('rejects missing configs or configs from another store', async () => {
    const missing = makeUseCase(null);
    const foreign = makeUseCase(makeConfig('store-2'));

    await expect(
      missing.useCase.execute({ storeId: 'store-1', configId: 'config-1' }),
    ).rejects.toBeInstanceOf(WebhookConfigNotFoundError);
    await expect(
      foreign.useCase.execute({ storeId: 'store-1', configId: 'config-1' }),
    ).rejects.toBeInstanceOf(WebhookConfigNotFoundError);
  });

  it('delegates page, limit, and status to the repository and returns repository total', async () => {
    const logs = [makeLog('log-2'), makeLog('log-3')];
    const { useCase, webhookLogRepository } = makeUseCase(makeConfig(), logs, 21);

    const result = await useCase.execute({
      storeId: 'store-1',
      configId: 'config-1',
      page: 3,
      limit: 2,
      status: 'failed',
    });

    expect(webhookLogRepository.findByConfigId).toHaveBeenCalledWith('config-1', {
      page: 3,
      limit: 2,
      status: 'failed',
    });
    expect(webhookLogRepository.countByConfigId).toHaveBeenCalledWith('config-1', 'failed');
    expect(result).toEqual({
      logs,
      total: 21,
      page: 3,
      limit: 2,
    });
  });

  it.each(['delivered', 'failed', 'pending'] as const)(
    'passes the %s filter through unchanged',
    async (status) => {
      const { useCase, webhookLogRepository } = makeUseCase(makeConfig());

      await useCase.execute({
        storeId: 'store-1',
        configId: 'config-1',
        status,
      });

      expect(webhookLogRepository.findByConfigId).toHaveBeenCalledWith('config-1', {
        page: 1,
        limit: 50,
        status,
      });
      expect(webhookLogRepository.countByConfigId).toHaveBeenCalledWith('config-1', status);
    },
  );
});
