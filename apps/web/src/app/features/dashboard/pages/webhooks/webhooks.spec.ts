import { TestBed } from '@angular/core/testing';
import {
  WebhookConfig,
  WebhookDeliveryStatus,
  WebhookLog,
  WebhookService,
} from '../../../../core/services/webhook.service';
import { Webhooks } from './webhooks';

describe('Webhooks', () => {
  function createComponent(): Webhooks {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: WebhookService,
          useValue: {},
        },
      ],
    });

    return TestBed.runInInjectionContext(() => new Webhooks());
  }

  function createLog(overrides: Partial<WebhookLog> = {}): WebhookLog {
    return {
      id: 'log-1',
      configId: 'config-1',
      deliveryId: 'delivery-1',
      eventType: 'payment.confirmed',
      payload: {},
      attempt: 0,
      maxAttempts: 5,
      createdAt: '2026-05-22T12:00:00.000Z',
      ...overrides,
    };
  }

  it.each([
    ['PENDING', 'Pendente', 'neutral', false],
    ['DELIVERED', 'Entregue', 'ok', false],
    ['FAILED_RETRYABLE', 'Falha temporária', 'warn', true],
    ['FAILED_FINAL', 'Falha final', 'bad', true],
  ] satisfies Array<[WebhookDeliveryStatus, string, string, boolean]>)(
    'maps canonical %s logs to status UI helpers',
    (status, label, tone, canRetry) => {
      const component = createComponent();
      const log = createLog({ status });

      expect(component.resolveLogStatus(log)).toBe(status);
      expect(component.getLogStatusLabel(log)).toBe(label);
      expect(component.getLogStatusTone(log)).toBe(tone);
      expect(component.canRetryLog(log)).toBe(canRetry);
    },
  );

  it('falls back to legacy response fields when status is absent', () => {
    const component = createComponent();

    expect(component.resolveLogStatus(createLog({ responseStatus: 204 }))).toBe('DELIVERED');
    expect(component.resolveLogStatus(createLog({ responseStatus: 500, attempt: 1 }))).toBe(
      'FAILED_RETRYABLE',
    );
    expect(
      component.resolveLogStatus(
        createLog({ responseStatus: undefined, attempt: 5, maxAttempts: 5 }),
      ),
    ).toBe('FAILED_FINAL');
    expect(component.resolveLogStatus(createLog({ responseStatus: undefined, attempt: 0 }))).toBe(
      'PENDING',
    );
  });

  it('ignores unknown legacy status values and derives from delivery fields', () => {
    const component = createComponent();
    const log = createLog({
      status: 'FAILED' as WebhookDeliveryStatus,
      deliveredAt: '2026-05-22T12:00:01.000Z',
    });

    expect(component.resolveLogStatus(log)).toBe('DELIVERED');
    expect(component.canRetryLog(log)).toBe(false);
  });

  describe('circuit breaker', () => {
    function createHook(circuit?: WebhookConfig['circuit']): WebhookConfig {
      return {
        id: 'config-1',
        url: 'https://api.example.com/hockpay',
        prefix: 'whsec_test',
        events: ['payment.confirmed'],
        isActive: true,
        circuit,
        createdAt: '2026-05-15T12:00:00.000Z',
        updatedAt: '2026-05-15T12:00:00.000Z',
      };
    }

    it('says nothing when the destination is healthy', () => {
      const component = createComponent();

      expect(component.isCircuitOpen(createHook({ state: 'closed', consecutiveFailures: 0 }))).toBe(
        false,
      );
      // Uma API que ainda nao manda o campo nao pode virar alarme falso.
      expect(component.isCircuitOpen(createHook(undefined))).toBe(false);
    });

    it('explains an open circuit with the failure count and when it retries', () => {
      const component = createComponent();
      const hook = createHook({
        state: 'open',
        consecutiveFailures: 5,
        openUntil: '2026-05-15T12:01:00.000Z',
      });

      expect(component.isCircuitOpen(hook)).toBe(true);
      expect(component.circuitDetail(hook)).toContain('5 falhas seguidas');
      expect(component.circuitDetail(hook)).toContain('nova tentativa');
    });

    it('still reports the failures when there is no retry timestamp', () => {
      const component = createComponent();
      const hook = createHook({ state: 'open', consecutiveFailures: 1 });

      expect(component.circuitDetail(hook)).toBe('1 falha seguida');
    });
  });
});
