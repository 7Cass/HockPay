import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { Magnetic } from '../../motion/magnetic';
import { EventReceipt, ReceiptLine } from '../event-receipt/event-receipt';
import { OrganicBlob } from '../organic-blob/organic-blob';

/** The three endings a developer can force on a simulated charge. */
type Outcome = 'confirmed' | 'failed' | 'expired';
export type SimStatus = 'idle' | 'pending' | Outcome;
type Tone = ReceiptLine['tone'];

interface StatusFace {
  readonly label: string;
  readonly caption: string;
}

const CHARGE_ID = 'pay_3f8Ka92LmQ';
const COUNTDOWN_SECONDS = 300;

/** Until someone takes over, the stage keeps showing every ending, in turn. */
const DEMO_CYCLE: readonly Outcome[] = ['confirmed', 'failed', 'expired'];

/**
 * The landing's centerpiece: a Pix charge whose ending the visitor picks.
 *
 * While nobody has touched it and it is on screen, it cycles through the
 * endings on its own; it pauses when scrolled away. The first click hands the
 * controls over for good.
 */
@Component({
  selector: 'app-payment-simulator',
  imports: [OrganicBlob, EventReceipt, Magnetic],
  templateUrl: './payment-simulator.html',
  styleUrl: './payment-simulator.css',
})
export class PaymentSimulator {
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private countdown: ReturnType<typeof setInterval> | null = null;
  private sequence = 0;
  private readonly touched = signal(false);
  private visible = false;
  private demoStep = 0;

  readonly chargeId = CHARGE_ID;

  readonly status = signal<SimStatus>('idle');
  readonly events = signal<readonly ReceiptLine[]>([]);
  readonly busy = signal(false);
  readonly secondsLeft = signal(COUNTDOWN_SECONDS);

  /** The buttons lock only while the visitor's own action runs: the demo never blocks a click. */
  readonly locked = computed(() => this.busy() && this.touched());

  /** Every change of status, so the page around the stage can take the ending's color. */
  readonly statusChange = output<SimStatus>();

  readonly outcomes = [
    { id: 'confirmed' as const, action: 'confirm', label: 'Confirmar', tone: 'ok' },
    { id: 'failed' as const, action: 'fail', label: 'Recusar', tone: 'bad' },
    { id: 'expired' as const, action: 'expire', label: 'Expirar', tone: 'warn' },
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
        return { label: 'CONFIRMED', caption: 'Liquidado · líquido R$ 248,50' };
      case 'failed':
        return { label: 'FAILED', caption: 'Recusado · insufficient_funds' };
      case 'expired':
        return { label: 'EXPIRED', caption: 'QR vencido · nada foi cobrado' };
      case 'pending':
        return { label: 'PENDING', caption: 'Aguardando o seu desfecho' };
      default:
        return { label: 'IDLE', caption: 'Nenhuma cobrança criada' };
    }
  });

  constructor() {
    const host = inject(ElementRef).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    let observer: IntersectionObserver | undefined;

    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;

      observer = new IntersectionObserver(
        ([entry]) => {
          this.visible = entry.isIntersecting;
          if (this.touched()) return;
          if (this.visible) this.later(() => this.demo(), 600);
          else this.pause();
        },
        { threshold: 0.25 },
      );
      observer.observe(host);
    });

    destroyRef.onDestroy(() => {
      observer?.disconnect();
      this.stopCountdown();
      this.clearTimers();
    });
  }

  /** Creates the charge and leaves it hanging, waiting for a chosen ending. */
  charge(manual = true): void {
    if (manual) this.takeOver();
    this.clearTimers();
    this.busy.set(true);
    this.setStatus('idle');
    this.events.set([]);

    this.later(() => {
      this.setStatus('pending');
      this.push('payment.created', 'Cobrança Pix gerada · QR válido por 5 min', 'neutral');
      this.busy.set(false);
      this.startCountdown();
    }, 420);
  }

  /** Forces one of the three endings, streaming the events it produces. */
  settle(outcome: Outcome, manual = true): void {
    if (manual) this.takeOver();
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
      this.setStatus(outcome);
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
    this.takeOver();
    this.clearTimers();
    this.stopCountdown();
    this.busy.set(false);
    this.setStatus('idle');
    this.events.set([]);
    this.secondsLeft.set(COUNTDOWN_SECONDS);
  }

  /** The first touch stops the demo wherever it is, so that click is never swallowed. */
  private takeOver(): void {
    if (this.touched()) return;
    this.touched.set(true);
    this.clearTimers();
    this.stopCountdown();
    this.busy.set(false);
  }

  private demo(): void {
    if (this.touched() || !this.visible) return;
    const outcome = DEMO_CYCLE[this.demoStep++ % DEMO_CYCLE.length];

    this.charge(false);
    this.later(() => {
      this.settle(outcome, false);
      this.later(() => this.demo(), 3800);
    }, 1400);
  }

  /** Freezes the demo where it is; it picks up with a fresh charge when back on screen. */
  private pause(): void {
    this.clearTimers();
    this.stopCountdown();
    this.busy.set(false);
  }

  private setStatus(status: SimStatus): void {
    this.status.set(status);
    this.statusChange.emit(status);
  }

  private push(name: string, note: string, tone: Tone): void {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    this.events.update((list) => [...list, { id: ++this.sequence, name, note, tone, time }]);
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
