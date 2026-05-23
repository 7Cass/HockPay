import { TestBed } from '@angular/core/testing';
import {
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
    ['PENDING', 'Pendente', 'lucideClock', false],
    ['DELIVERED', 'Entregue', 'lucideCheck', false],
    ['FAILED_RETRYABLE', 'Falha temporária', 'lucideAlertTriangle', true],
    ['FAILED_FINAL', 'Falha final', 'lucideXCircle', true],
  ] satisfies Array<[WebhookDeliveryStatus, string, string, boolean]>)(
    'maps canonical %s logs to status UI helpers',
    (status, label, icon, canRetry) => {
      const component = createComponent();
      const log = createLog({ status });

      expect(component.resolveLogStatus(log)).toBe(status);
      expect(component.getLogStatusLabel(log)).toBe(label);
      expect(component.getLogStatusIcon(log)).toBe(icon);
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
});
