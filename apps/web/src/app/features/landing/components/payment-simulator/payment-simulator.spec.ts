import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PaymentSimulator } from './payment-simulator';

describe('PaymentSimulator', () => {
  function createComponent() {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    return TestBed.createComponent(PaymentSimulator).componentInstance;
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('creates the charge first when a desfecho is picked from idle', () => {
    const simulator = createComponent();

    simulator.settle('failed');
    vi.advanceTimersByTime(420);

    expect(simulator.status()).toBe('pending');
    expect(simulator.events().map((event) => event.name)).toEqual(['payment.created']);
  });

  it('settles on the chosen outcome and delivers the webhook after it', () => {
    const simulator = createComponent();

    simulator.settle('expired');
    vi.advanceTimersByTime(420 + 700 + 760);

    expect(simulator.status()).toBe('expired');
    expect(simulator.settled()).toBe(true);
    expect(simulator.events().at(-1)?.name).toBe('payment.expired');

    vi.advanceTimersByTime(620);

    expect(simulator.events().map((event) => event.name)).toEqual([
      'payment.created',
      'payment.expired',
      'webhook.delivered',
    ]);
  });

  it('counts the charge down only while it is pending', () => {
    const simulator = createComponent();

    simulator.charge();
    vi.advanceTimersByTime(420 + 3000);
    expect(simulator.clock()).toBe('4:57');

    simulator.settle('confirmed');
    vi.advanceTimersByTime(760);
    const frozen = simulator.clock();

    vi.advanceTimersByTime(5000);
    expect(simulator.clock()).toBe(frozen);
  });

  it('reset clears the charge and its events', () => {
    const simulator = createComponent();

    simulator.settle('confirmed');
    vi.advanceTimersByTime(420 + 700 + 760 + 620);
    simulator.reset();

    expect(simulator.status()).toBe('idle');
    expect(simulator.events()).toEqual([]);
    expect(simulator.settled()).toBe(false);
  });
});
