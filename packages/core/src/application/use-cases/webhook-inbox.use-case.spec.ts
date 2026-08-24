import { describe, expect, it, vi } from 'vitest';
import { WebhookConfig } from '../../domain/entities/webhook-config.entity';
import { CreateWebhookInboxUseCase } from './create-webhook-inbox.use-case';
import { ReceiveWebhookInboxEventUseCase } from './receive-webhook-inbox-event.use-case';

describe('Webhook inbox use cases', () => {
  it('creates an internal receiver webhook config', async () => {
    const webhookConfigRepository = {
      save: vi.fn(),
    };
    const useCase = new CreateWebhookInboxUseCase(
      webhookConfigRepository as any,
      {
        generate: vi.fn().mockReturnValue('abc123abc123abc123abc123abc123ab'),
      } as any,
      {
        encrypt: vi.fn((value: string) => `encrypted:${value}`),
      } as any,
    );

    const result = await useCase.execute({
      storeId: 'store-1',
      baseUrl: 'http://localhost:3000/',
    });

    expect(result.plainSecret).toBe('whsec_abc123abc123abc123abc123abc123ab');
    expect(result.webhookConfig.url).toBe(
      `http://localhost:3000/api/v1/dev/webhook-inbox/${result.webhookConfig.id}`,
    );
    expect(result.webhookConfig.events).toContain('payment.confirmed');
    expect(webhookConfigRepository.save).toHaveBeenCalledTimes(1);
  });

  it('stores a received inbox event with trace IDs when the signature is valid', async () => {
    const config = WebhookConfig.reconstitute({
      id: 'config-1',
      storeId: 'store-1',
      url: 'http://localhost:3000/api/v1/dev/webhook-inbox/config-1',
      secret: 'encrypted-secret',
      prefix: 'whsec_test',
      events: ['payment.confirmed'],
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const webhookInboxEventRepository = {
      save: vi.fn(),
    };
    const payload = {
      id: 'outbox-1',
      type: 'payment.confirmed',
      data: {
        id: 'payment-1',
      },
    };

    const useCase = new ReceiveWebhookInboxEventUseCase(
      {
        findById: vi.fn().mockResolvedValue(config),
      } as any,
      webhookInboxEventRepository as any,
      {
        sign: vi.fn().mockReturnValue('sha256=valid'),
      } as any,
      {
        decrypt: vi.fn().mockReturnValue('plain-secret'),
      } as any,
    );

    const result = await useCase.execute({
      configId: 'config-1',
      payload,
      headers: {
        'x-hockpay-signature': 'sha256=valid',
        'x-hockpay-timestamp': '1770000000',
        'x-hockpay-webhook-id': 'delivery-1',
        'x-request-id': 'req-1',
      },
    });

    expect(result.event.signatureValid).toBe(true);
    expect(result.event.storeId).toBe('store-1');
    expect(result.event.outboxEventId).toBe('outbox-1');
    expect(result.event.paymentId).toBe('payment-1');
    expect(result.event.deliveryId).toBe('delivery-1');
    expect(webhookInboxEventRepository.save).toHaveBeenCalledTimes(1);
  });
});
