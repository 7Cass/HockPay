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
import { lucideCheck, lucideClock, lucideShieldCheck, lucideX } from '@ng-icons/lucide';

/** The three endings a developer can force on a simulated charge. */
type Outcome = 'confirmed' | 'failed' | 'expired';
type SimStatus = 'idle' | 'pending' | Outcome;
type Tone = 'neutral' | 'ok' | 'bad' | 'warn';

interface SimEvent {
  readonly id: number;
  readonly name: string;
  readonly note: string;
  readonly tone: Tone;
  readonly time: string;
}

interface StatusFace {
  readonly label: string;
  readonly caption: string;
  readonly tone: Tone;
}

const CHARGE_ID = 'pay_3f8Ka92LmQ';
const COUNTDOWN_SECONDS = 300;
const QR_SIZE = 25;

/**
 * A QR look-alike: the three finder squares plus seeded noise, as one SVG path.
 * Pure decoration: it encodes nothing, and the seed keeps it identical per render.
 */
function qrPath(size: number, seed: number): string {
  let state = seed;
  const noise = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32 < 0.47;
  const corners = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ];

  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const corner = corners.find(
        ([cx, cy]) => x >= cx - 1 && x <= cx + 7 && y >= cy - 1 && y <= cy + 7,
      );
      // Finder: ring 3 is the outer square, ring <= 1 the core, ring 4 the separator.
      const ring = corner ? Math.max(Math.abs(x - corner[0] - 3), Math.abs(y - corner[1] - 3)) : -1;
      const dark = corner ? ring === 3 || ring <= 1 : noise();
      if (dark) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return d;
}

/**
 * The landing's centerpiece: a Pix charge whose ending the visitor picks.
 *
 * It plays one happy path on its own the first time it scrolls into view, then
 * stops autoplaying for good and hands the controls over.
 */
@Component({
  selector: 'app-payment-simulator',
  imports: [NgIcon],
  providers: [provideIcons({ lucideCheck, lucideClock, lucideShieldCheck, lucideX })],
  templateUrl: './payment-simulator.html',
  styleUrl: './payment-simulator.css',
})
export class PaymentSimulator {
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private countdown: ReturnType<typeof setInterval> | null = null;
  private sequence = 0;
  private touched = false;

  readonly chargeId = CHARGE_ID;
  readonly qrSize = QR_SIZE;
  readonly qr = qrPath(QR_SIZE, 0x3f8a92);

  readonly status = signal<SimStatus>('idle');
  readonly events = signal<readonly SimEvent[]>([]);
  readonly busy = signal(false);
  readonly secondsLeft = signal(COUNTDOWN_SECONDS);

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

  /** The mark stamped over the QR once the charge has an ending. */
  readonly stamp = computed(() => {
    switch (this.status()) {
      case 'confirmed':
        return 'lucideCheck';
      case 'failed':
        return 'lucideX';
      case 'expired':
        return 'lucideClock';
      default:
        return null;
    }
  });

  readonly face = computed<StatusFace>(() => {
    switch (this.status()) {
      case 'confirmed':
        return { label: 'CONFIRMED', caption: 'Liquidado · líquido R$ 248,50', tone: 'ok' };
      case 'failed':
        return { label: 'FAILED', caption: 'Recusado · insufficient_funds', tone: 'bad' };
      case 'expired':
        return { label: 'EXPIRED', caption: 'QR vencido · nada foi cobrado', tone: 'warn' };
      case 'pending':
        return { label: 'PENDING', caption: 'Aguardando desfecho', tone: 'neutral' };
      default:
        return { label: 'IDLE', caption: 'Nenhuma cobrança criada', tone: 'neutral' };
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
