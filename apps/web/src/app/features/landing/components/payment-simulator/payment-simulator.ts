import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldCheck } from '@ng-icons/lucide';

/** The three endings a developer can force on a simulated charge. */
type Outcome = 'confirmed' | 'failed' | 'expired';
type SimStatus = 'idle' | 'pending' | Outcome;

interface SimEvent {
  readonly id: number;
  readonly name: string;
  readonly note: string;
  readonly tone: 'neutral' | 'ok' | 'bad' | 'warn';
}

interface StatusFace {
  readonly label: string;
  readonly caption: string;
  readonly chip: string;
  readonly dot: string;
  readonly accent: string;
}

const CHARGE_ID = 'pay_3f8Ka92LmQ';
const COUNTDOWN_SECONDS = 300;

/**
 * The landing's centerpiece: a Pix charge whose ending the visitor picks.
 *
 * It plays one happy path on its own the first time it scrolls into view, then
 * stops autoplaying for good and hands the controls over.
 */
@Component({
  selector: 'app-payment-simulator',
  imports: [NgIcon],
  providers: [provideIcons({ lucideShieldCheck })],
  templateUrl: './payment-simulator.html',
  styleUrl: './payment-simulator.css',
})
export class PaymentSimulator {
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private countdown: ReturnType<typeof setInterval> | null = null;
  private sequence = 0;
  private touched = false;

  readonly chargeId = CHARGE_ID;

  readonly status = signal<SimStatus>('idle');
  readonly events = signal<readonly SimEvent[]>([]);
  readonly busy = signal(false);
  readonly secondsLeft = signal(COUNTDOWN_SECONDS);

  readonly outcomes = [
    { id: 'confirmed' as const, action: 'confirm', label: 'Confirmar' },
    { id: 'failed' as const, action: 'fail', label: 'Recusar' },
    { id: 'expired' as const, action: 'expire', label: 'Expirar' },
  ];

  readonly settled = computed(() => {
    const status = this.status();
    return status !== 'idle' && status !== 'pending';
  });

  readonly clock = computed(() => {
    const total = this.secondsLeft();
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  readonly face = computed<StatusFace>(() => {
    switch (this.status()) {
      case 'confirmed':
        return {
          label: 'CONFIRMED',
          caption: 'Liquidado · líquido R$ 248,50',
          chip: 'bg-ok-soft text-ok',
          dot: 'bg-ok',
          accent: 'border-ok/35',
        };
      case 'failed':
        return {
          label: 'FAILED',
          caption: 'Recusado · insufficient_funds',
          chip: 'bg-bad-soft text-bad',
          dot: 'bg-bad',
          accent: 'border-bad/35',
        };
      case 'expired':
        return {
          label: 'EXPIRED',
          caption: 'QR vencido · nada foi cobrado',
          chip: 'bg-warn-soft text-warn',
          dot: 'bg-warn',
          accent: 'border-warn/35',
        };
      case 'pending':
        return {
          label: 'PENDING',
          caption: 'Aguardando desfecho',
          chip: 'bg-ink/[0.06] text-ink-soft',
          dot: 'bg-ink-faint',
          accent: 'border-hairline',
        };
      default:
        return {
          label: 'IDLE',
          caption: 'Nenhuma cobrança criada',
          chip: 'bg-ink/[0.06] text-ink-faint',
          dot: 'bg-ink-faint/60',
          accent: 'border-hairline',
        };
    }
  });

  constructor() {
    const host = inject(ElementRef).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    let autoplay: IntersectionObserver | undefined;

    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;

      autoplay = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            autoplay?.disconnect();
            this.later(() => this.demo(), 600);
          }
        },
        { threshold: 0.35 },
      );
      autoplay.observe(host);
    });

    destroyRef.onDestroy(() => {
      autoplay?.disconnect();
      this.stopCountdown();
      this.clearTimers();
    });
  }

  /** Creates the charge and leaves it hanging, waiting for a chosen ending. */
  charge(manual = true): void {
    if (manual) this.touched = true;
    this.clearTimers();
    this.busy.set(true);
    this.status.set('idle');
    this.events.set([]);

    this.later(() => {
      this.status.set('pending');
      this.push('payment.created', 'Cobrança Pix gerada · QR válido por 5 min', 'neutral');
      this.busy.set(false);
      this.startCountdown();
    }, 420);
  }

  /** Forces one of the three endings, streaming the events it produces. */
  settle(outcome: Outcome, manual = true): void {
    if (manual) this.touched = true;
    if (this.busy()) return;

    if (this.status() === 'idle') {
      this.charge(manual);
      this.later(() => this.settle(outcome, false), 700);
      return;
    }

    this.clearTimers();
    this.busy.set(true);
    this.stopCountdown();

    this.later(() => {
      this.status.set(outcome);
      this.busy.set(false);

      if (outcome === 'confirmed') {
        this.push('payment.confirmed', 'Liquidação simulada · líquido R$ 248,50', 'ok');
      } else if (outcome === 'failed') {
        this.push('payment.failed', 'Recusa forçada · reason: insufficient_funds', 'bad');
      } else {
        this.push('payment.expired', 'QR vencido · nenhuma cobrança gerada', 'warn');
      }

      this.later(
        () => this.push('webhook.delivered', 'POST /webhooks/hockpay · 200 OK · 118 ms', 'neutral'),
        620,
      );
    }, 760);
  }

  reset(): void {
    this.touched = true;
    this.clearTimers();
    this.stopCountdown();
    this.busy.set(false);
    this.status.set('idle');
    this.events.set([]);
    this.secondsLeft.set(COUNTDOWN_SECONDS);
  }

  private demo(): void {
    if (this.touched) return;
    this.charge(false);
    this.later(() => {
      if (!this.touched) this.settle('confirmed', false);
    }, 1500);
  }

  private push(name: string, note: string, tone: SimEvent['tone']): void {
    this.events.update((list) => [...list, { id: ++this.sequence, name, note, tone }]);
  }

  private startCountdown(): void {
    this.stopCountdown();
    this.secondsLeft.set(COUNTDOWN_SECONDS);
    this.countdown = setInterval(() => {
      const next = this.secondsLeft() - 1;
      this.secondsLeft.set(Math.max(next, 0));
      if (next <= 0) this.stopCountdown();
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdown === null) return;
    clearInterval(this.countdown);
    this.countdown = null;
  }

  private later(fn: () => void, ms: number): void {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  private clearTimers(): void {
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
  }
}
