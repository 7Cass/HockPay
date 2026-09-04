import { describe, expect, it, vi } from 'vitest';
import { OutboxEvent, OutboxEventStatus } from '../../domain/entities/outbox-event.entity';
import { WebhookConfig } from '../../domain/entities/webhook-config.entity';
import { WebhookLog } from '../../domain/entities/webhook-log.entity';
import { ProcessWebhookUseCase } from './process-webhook.use-case';

describe('ProcessWebhookUseCase', () => {
  function makeEvent() {
    const event = OutboxEvent.create({
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      eventType: 'payment.created',
      requestId: 'req-1',
      payload: {
        id: 'payment-1',
        storeId: 'store-1',
        amount: 1000,
      },
    });
    event.markAsDispatched(new Date('2026-01-01T00:45:00.000Z'));
    return event;
  }

  function makeConfig(id: string, url: string, secret = `encrypted-${id}`) {
    return WebhookConfig.reconstitute({
      id,
      storeId: 'store-1',
      url,
      secret,
      prefix: 'whsec_test',
      events: ['payment.created'],
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  }

  function makeUseCase({
    event,
    configs,
    sender,
    encryption = { decrypt: vi.fn().mockReturnValue('plain-secret') },
    existingDeliveries = {},
    circuitBreaker,
  }: {
    event: OutboxEvent;
    configs: WebhookConfig[];
    sender: any;
    encryption?: any;
    existingDeliveries?: Record<string, WebhookLog | null>;
    circuitBreaker?: any;
  }) {
    const outboxRepository = {
      findById: vi.fn().mockResolvedValue(event),
      update: vi.fn(),
    };
    const webhookConfigRepository = {
      findActiveForEvent: vi.fn().mockResolvedValue(configs),
    };
    const webhookLogRepository = {
      save: vi.fn(),
      upsertDelivery: vi.fn(),
      findByConfigAndOutboxEvent: vi.fn((configId: string, outboxEventId: string) => {
        const key = `${configId}:${outboxEventId}`;
        return Promise.resolve(existingDeliveries[key] ?? null);
      }),
    };
    const useCase = new ProcessWebhookUseCase(
      outboxRepository as any,
      webhookConfigRepository as any,
      webhookLogRepository as any,
      sender,
      {
        sign: vi.fn().mockReturnValue('signature'),
      } as any,
      encryption,
      undefined,
      circuitBreaker,
    );

    return {
      useCase,
      outboxRepository,
      webhookConfigRepository,
      webhookLogRepository,
    };
  }

  function makeDeliveryLog(event: OutboxEvent, configId: string) {
    return WebhookLog.create({
      configId,
      paymentId: 'payment-1',
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      outboxEventId: event.id,
      requestId: event.requestId,
      eventType: event.eventType,
      payload: {
        id: event.id,
        type: event.eventType,
        data: event.payload,
      },
    });
  }

  function makeDeliveredLog(event: OutboxEvent, configId: string) {
    const log = makeDeliveryLog(event, configId);
    log.beginAttempt(event.requestId);
    log.recordSuccess(200, 'ok');
    return log;
  }

  it('leaves outbox status unchanged on transient delivery failure', async () => {
    const event = makeEvent();
    const config = makeConfig('webhook-config-1', 'https://example.com/webhook');
    const { useCase, outboxRepository, webhookLogRepository } = makeUseCase({
      event,
      configs: [config],
      sender: {
        send: vi.fn().mockResolvedValue({
          success: false,
          statusCode: 500,
          body: 'server error',
        }),
      } as any,
    });

    const result = await useCase.execute({ eventId: event.id });

    expect(result.delivered).toBe(false);
    expect(result.event.status).toBe(OutboxEventStatus.DISPATCHED);
    expect(outboxRepository.update).not.toHaveBeenCalled();
    expect(webhookLogRepository.upsertDelivery).toHaveBeenCalledTimes(1);
  });

  it('marks the outbox as processed after all webhook configs succeed', async () => {
    const event = makeEvent();
    const sender = {
      send: vi.fn().mockResolvedValue({
        success: true,
        statusCode: 200,
        body: 'ok',
      }),
    };
    const { useCase, outboxRepository, webhookLogRepository } = makeUseCase({
      event,
      configs: [
        makeConfig('webhook-config-1', 'https://example.com/one'),
        makeConfig('webhook-config-2', 'https://example.com/two'),
      ],
      sender: sender as any,
    });

    const result = await useCase.execute({ eventId: event.id });

    expect(result.delivered).toBe(true);
    expect(result.event.status).toBe(OutboxEventStatus.PROCESSED);
    expect(sender.send).toHaveBeenCalledTimes(2);
    expect(sender.send).toHaveBeenCalledWith(
      'https://example.com/one',
      expect.any(Object),
      expect.objectContaining({
        'X-Request-ID': 'req-1',
      }),
    );
    expect(webhookLogRepository.upsertDelivery).toHaveBeenCalledTimes(2);
    expect(webhookLogRepository.upsertDelivery.mock.calls[0][0].requestId).toBe('req-1');
    expect(webhookLogRepository.upsertDelivery.mock.calls[0][0].outboxEventId).toBe(event.id);
    expect(outboxRepository.update).toHaveBeenCalledWith(event);
  });

  it('logs non-payment aggregates without forcing paymentId', async () => {
    const event = OutboxEvent.create({
      aggregateType: 'Withdrawal',
      aggregateId: 'withdrawal-1',
      eventType: 'withdrawal.completed',
      requestId: 'req-withdrawal-1',
      payload: {
        id: 'withdrawal-1',
        storeId: 'store-1',
        amount: 10000,
      },
    });
    event.markAsDispatched(new Date('2026-01-01T00:45:00.000Z'));
    const { useCase, webhookLogRepository } = makeUseCase({
      event,
      configs: [makeConfig('webhook-config-1', 'https://example.com/one')],
      sender: {
        send: vi.fn().mockResolvedValue({
          success: true,
          statusCode: 200,
          body: 'ok',
        }),
      } as any,
    });

    await useCase.execute({ eventId: event.id });

    const log = webhookLogRepository.upsertDelivery.mock.calls[0][0];
    expect(log.paymentId).toBeUndefined();
    expect(log.aggregateType).toBe('Withdrawal');
    expect(log.aggregateId).toBe('withdrawal-1');
  });

  it('attempts every webhook config when one delivery fails', async () => {
    const event = makeEvent();
    const sender = {
      send: vi.fn((url: string) =>
        Promise.resolve(
          url.endsWith('/one')
            ? { success: false, statusCode: 500, body: 'server error' }
            : { success: true, statusCode: 200, body: 'ok' },
        ),
      ),
    };
    const { useCase, outboxRepository, webhookLogRepository } = makeUseCase({
      event,
      configs: [
        makeConfig('webhook-config-1', 'https://example.com/one'),
        makeConfig('webhook-config-2', 'https://example.com/two'),
      ],
      sender: sender as any,
    });

    const result = await useCase.execute({ eventId: event.id });

    expect(result.delivered).toBe(false);
    expect(result.error).toBe('HTTP 500');
    expect(result.event.status).toBe(OutboxEventStatus.DISPATCHED);
    expect(sender.send).toHaveBeenCalledTimes(2);
    expect(webhookLogRepository.upsertDelivery).toHaveBeenCalledTimes(2);
    expect(outboxRepository.update).not.toHaveBeenCalled();
  });

  it('does not resend webhook configs already delivered for the same outbox event', async () => {
    const event = makeEvent();
    const delivered = makeDeliveredLog(event, 'webhook-config-2');
    const sender = {
      send: vi.fn().mockResolvedValue({
        success: false,
        statusCode: 500,
        body: 'server error',
      }),
    };
    const { useCase, outboxRepository, webhookLogRepository } = makeUseCase({
      event,
      configs: [
        makeConfig('webhook-config-1', 'https://example.com/one'),
        makeConfig('webhook-config-2', 'https://example.com/two'),
      ],
      sender: sender as any,
      existingDeliveries: {
        [`webhook-config-2:${event.id}`]: delivered,
      },
    });

    const result = await useCase.execute({ eventId: event.id });

    expect(result.delivered).toBe(false);
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(sender.send).toHaveBeenCalledWith(
      'https://example.com/one',
      expect.any(Object),
      expect.any(Object),
    );
    expect(webhookLogRepository.upsertDelivery).toHaveBeenCalledTimes(1);
    expect(outboxRepository.update).not.toHaveBeenCalled();
  });

  it('marks the outbox as processed when every active config was already delivered', async () => {
    const event = makeEvent();
    const sender = {
      send: vi.fn(),
    };
    const { useCase, outboxRepository, webhookLogRepository } = makeUseCase({
      event,
      configs: [
        makeConfig('webhook-config-1', 'https://example.com/one'),
        makeConfig('webhook-config-2', 'https://example.com/two'),
      ],
      sender: sender as any,
      existingDeliveries: {
        [`webhook-config-1:${event.id}`]: makeDeliveredLog(event, 'webhook-config-1'),
        [`webhook-config-2:${event.id}`]: makeDeliveredLog(event, 'webhook-config-2'),
      },
    });

    const result = await useCase.execute({ eventId: event.id });

    expect(result.delivered).toBe(true);
    expect(result.event.status).toBe(OutboxEventStatus.PROCESSED);
    expect(sender.send).not.toHaveBeenCalled();
    expect(webhookLogRepository.upsertDelivery).not.toHaveBeenCalled();
    expect(outboxRepository.update).toHaveBeenCalledWith(event);
  });

  it('isolates unexpected config delivery errors from other webhook configs', async () => {
    const event = OutboxEvent.create({
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      eventType: 'payment.created',
      payload: {
        id: 'payment-1',
        storeId: 'store-1',
        amount: 1000,
      },
    });
    event.markAsDispatched(new Date('2026-01-01T00:45:00.000Z'));
    const sender = {
      send: vi.fn().mockResolvedValue({
        success: true,
        statusCode: 200,
        body: 'ok',
      }),
    };
    const { useCase, outboxRepository, webhookLogRepository } = makeUseCase({
      event,
      configs: [
        makeConfig('webhook-config-1', 'https://example.com/one', 'bad-secret'),
        makeConfig('webhook-config-2', 'https://example.com/two', 'good-secret'),
      ],
      sender: sender as any,
      encryption: {
        decrypt: vi.fn((secret: string) => {
          if (secret === 'bad-secret') {
            throw new Error('decrypt failed');
          }
          return 'plain-secret';
        }),
      },
    });

    const result = await useCase.execute({ eventId: event.id });

    expect(result.delivered).toBe(false);
    expect(result.error).toBe('decrypt failed');
    expect(result.event.status).toBe(OutboxEventStatus.DISPATCHED);
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(outboxRepository.update).not.toHaveBeenCalled();
    expect(webhookLogRepository.upsertDelivery).toHaveBeenCalledTimes(2);
  });

  it('does not infer storeId from nested payload data', async () => {
    const event = OutboxEvent.create({
      aggregateType: 'Payment',
      aggregateId: 'payment-1',
      eventType: 'payment.created',
      payload: {
        payment: {
          id: 'payment-1',
          storeId: 'store-1',
        },
      },
    });
    event.markAsDispatched(new Date('2026-01-01T00:45:00.000Z'));
    const sender = {
      send: vi.fn(),
    };
    const { useCase, outboxRepository, webhookConfigRepository } = makeUseCase({
      event,
      configs: [makeConfig('webhook-config-1', 'https://example.com/one')],
      sender: sender as any,
    });

    const result = await useCase.execute({ eventId: event.id });

    expect(result.delivered).toBe(true);
    expect(result.event.status).toBe(OutboxEventStatus.PROCESSED);
    expect(webhookConfigRepository.findActiveForEvent).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
    expect(outboxRepository.update).toHaveBeenCalledWith(event);
  });

  it('delivers a payment link event inside the versioned envelope', async () => {
    // O ambiente local nao consegue entregar webhook (a politica de URL do
    // worker exige NODE_ENV de desenvolvimento), entao a perna de entrega dos
    // eventos novos e coberta aqui: agregado PaymentLink, sem paymentId, e o
    // envelope carregando a versao congelada na producao.
    const event = OutboxEvent.create({
      aggregateType: 'PaymentLink',
      aggregateId: 'link-1',
      eventType: 'payment_link.paid',
      requestId: 'req-1',
      payload: {
        id: 'link-1',
        storeId: 'store-1',
        status: 'PAID',
        checkout_url: 'https://checkout.example.com/pay/token',
      },
    });
    event.markAsDispatched(new Date('2026-01-01T00:45:00.000Z'));

    const config = WebhookConfig.reconstitute({
      id: 'webhook-config-1',
      storeId: 'store-1',
      url: 'https://example.com/webhook',
      secret: 'encrypted-1',
      prefix: 'whsec_test',
      events: ['payment_link.paid'],
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const send = vi.fn().mockResolvedValue({ success: true, statusCode: 200, body: 'ok' });
    const { useCase, outboxRepository } = makeUseCase({
      event,
      configs: [config],
      sender: { send },
    });

    const result = await useCase.execute({ eventId: event.id });

    expect(result.delivered).toBe(true);
    expect(outboxRepository.update).toHaveBeenCalled();

    const [, deliveredBody] = send.mock.calls[0];
    expect(deliveredBody).toEqual({
      id: event.id,
      type: 'payment_link.paid',
      version: 1,
      created_at: event.createdAt.toISOString(),
      data: {
        id: 'link-1',
        storeId: 'store-1',
        status: 'PAID',
        checkout_url: 'https://checkout.example.com/pay/token',
      },
    });
  });

  describe('circuit breaker', () => {
    function makeBreaker(overrides: Partial<Record<string, any>> = {}) {
      return {
        shouldAttempt: vi.fn().mockResolvedValue(true),
        recordSuccess: vi.fn(),
        recordTransportFailure: vi.fn(),
        status: vi.fn(),
        ...overrides,
      };
    }

    it('does not open a socket for a destination whose circuit is open', async () => {
      const event = makeEvent();
      const config = makeConfig('webhook-config-1', 'https://example.com/webhook');
      const send = vi.fn();
      const circuitBreaker = makeBreaker({ shouldAttempt: vi.fn().mockResolvedValue(false) });
      const { useCase, outboxRepository } = makeUseCase({
        event,
        configs: [config],
        sender: { send },
        circuitBreaker,
      });

      const result = await useCase.execute({ eventId: event.id });

      expect(send).not.toHaveBeenCalled();
      expect(result.delivered).toBe(false);
      // O evento tem que sobreviver para ser reentregue quando o circuito fechar.
      expect(outboxRepository.update).not.toHaveBeenCalled();
    });

    it('keeps delivering to healthy destinations while one is open', async () => {
      const event = makeEvent();
      const healthy = makeConfig('healthy', 'https://healthy.example.com/webhook');
      const stuck = makeConfig('stuck', 'https://stuck.example.com/webhook');
      const send = vi.fn().mockResolvedValue({ success: true, statusCode: 200, body: 'ok' });
      const circuitBreaker = makeBreaker({
        shouldAttempt: vi.fn(async (configId: string) => configId !== 'stuck'),
      });
      const { useCase, outboxRepository } = makeUseCase({
        event,
        configs: [healthy, stuck],
        sender: { send },
        circuitBreaker,
      });

      const result = await useCase.execute({ eventId: event.id });

      // O ponto do breaker: um destino travado nao segura os demais.
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0][0]).toBe('https://healthy.example.com/webhook');
      // Mas o evento so fecha quando todo destino tiver recebido.
      expect(result.delivered).toBe(false);
      expect(outboxRepository.update).not.toHaveBeenCalled();
    });

    it('counts a transport failure, but not a 4xx the merchant chose to answer', async () => {
      const rejected = makeEvent();
      const config = makeConfig('webhook-config-1', 'https://example.com/webhook');
      const businessBreaker = makeBreaker();
      const business = makeUseCase({
        event: rejected,
        configs: [config],
        sender: {
          send: vi.fn().mockResolvedValue({
            success: false,
            statusCode: 422,
            body: 'unprocessable',
            failureKind: 'response',
          }),
        },
        circuitBreaker: businessBreaker,
      });
      await business.useCase.execute({ eventId: rejected.id });
      expect(businessBreaker.recordTransportFailure).not.toHaveBeenCalled();

      const hung = makeEvent();
      const transportBreaker = makeBreaker();
      const transport = makeUseCase({
        event: hung,
        configs: [config],
        sender: {
          send: vi.fn().mockResolvedValue({
            success: false,
            statusCode: 0,
            body: 'timeout',
            failureKind: 'transport',
          }),
        },
        circuitBreaker: transportBreaker,
      });
      await transport.useCase.execute({ eventId: hung.id });
      expect(transportBreaker.recordTransportFailure).toHaveBeenCalledWith('webhook-config-1');
    });

    it('does not count a destination the URL policy blocked before any socket', async () => {
      const event = makeEvent();
      const config = makeConfig('webhook-config-1', 'http://blocked.example.com/webhook');
      const circuitBreaker = makeBreaker();
      const { useCase } = makeUseCase({
        event,
        configs: [config],
        sender: {
          send: vi.fn().mockResolvedValue({
            success: false,
            statusCode: 0,
            body: 'Webhook URL is not allowed',
            failureKind: 'blocked',
          }),
        },
        circuitBreaker,
      });

      await useCase.execute({ eventId: event.id });

      expect(circuitBreaker.recordTransportFailure).not.toHaveBeenCalled();
    });

    it('closes the circuit on a successful delivery', async () => {
      const event = makeEvent();
      const config = makeConfig('webhook-config-1', 'https://example.com/webhook');
      const circuitBreaker = makeBreaker();
      const { useCase } = makeUseCase({
        event,
        configs: [config],
        sender: {
          send: vi.fn().mockResolvedValue({ success: true, statusCode: 200, body: 'ok' }),
        },
        circuitBreaker,
      });

      await useCase.execute({ eventId: event.id });

      expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('webhook-config-1');
    });
  });
});
