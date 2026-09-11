import {
  Component,
  DOCUMENT,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideArrowUpRight,
  lucideBoxes,
  lucideCheck,
  lucideCopy,
  lucideLink2,
  lucideMenu,
  lucideReceipt,
  lucideRepeat2,
  lucideWallet,
  lucideWebhook,
  lucideX,
} from '@ng-icons/lucide';
import { PaymentSimulator } from '../../components/payment-simulator/payment-simulator';
import { Reveal } from '../../../../shared/directives/reveal';

const CHARGE_ID = 'pay_3f8Ka92LmQ';

/** O chão da landing escura; o resto do produto segue no papel claro. */
const NIGHT = '#09090b';

type Tone = 'ok' | 'bad' | 'warn' | 'neutral';

@Component({
  selector: 'app-home',
  imports: [RouterLink, NgIcon, Reveal, PaymentSimulator],
  providers: [
    provideIcons({
      lucideArrowRight,
      lucideArrowUpRight,
      lucideBoxes,
      lucideCheck,
      lucideCopy,
      lucideLink2,
      lucideMenu,
      lucideReceipt,
      lucideRepeat2,
      lucideWallet,
      lucideWebhook,
      lucideX,
    }),
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  // ── Navigation ────────────────────────────────────────────────────────────
  protected readonly scrolled = signal(false);
  protected readonly menuOpen = signal(false);

  protected readonly navLinks = [
    { href: '#simulador', label: 'Simulador' },
    { href: '#cenarios', label: 'Cenários' },
    { href: '#api', label: 'API' },
    { href: '#recursos', label: 'Recursos' },
  ] as const;

  // ── Code tabs ─────────────────────────────────────────────────────────────
  protected readonly tabs = [
    {
      id: 'curl',
      label: 'cURL',
      code: `curl -X POST https://api.hockpay.dev/api/v1/payments \\
  -H "Authorization: Bearer hk_test_9f2c…" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order_1042" \\
  -d '{
    "amount": 25000,
    "paymentMethod": "PIX",
    "customer": { "document": "12345678909" }
  }'

# você decide o final:
curl -X POST .../payments/${CHARGE_ID}/simulate/confirm`,
    },
    {
      id: 'node',
      label: 'Node',
      code: `const res = await fetch(\`\${base}/payments\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.HOCKPAY_TEST_KEY}\`,
    "Content-Type": "application/json",
    "Idempotency-Key": "order_1042",
  },
  body: JSON.stringify({
    amount: 25_000,
    paymentMethod: "PIX",
    customer: { document: "12345678909" },
  }),
});

const payment = await res.json();

// confirm | fail | expire — o desfecho é seu
await fetch(\`\${base}/payments/\${payment.id}/simulate/fail\`, {
  method: "POST",
  headers: { Authorization: \`Bearer \${key}\` },
});`,
    },
    {
      id: 'webhook',
      label: 'Webhook',
      code: `POST /webhooks/hockpay
X-Hockpay-Signature: t=1771027200,v1=8b41c…
Content-Type: application/json

{
  "event": "payment.confirmed",
  "created": "2026-02-13T18:20:04.117Z",
  "data": {
    "id": "${CHARGE_ID}",
    "status": "CONFIRMED",
    "amount": 25000,
    "fee": 150,
    "net": 24850,
    "mode": "TEST"
  }
}

// assinado com HMAC, com retry e backoff — igual produção`,
    },
  ];

  protected readonly activeTab = signal(this.tabs[0].id);
  protected readonly copied = signal(false);

  protected readonly activeCode = computed(
    () => this.tabs.find((tab) => tab.id === this.activeTab())?.code ?? '',
  );

  /** Linhas de comentário saem apagadas; o resto do código fica em primeiro plano. */
  protected readonly activeLines = computed(() =>
    this.activeCode()
      .split('\n')
      .map((text) => ({ text, comment: /^\s*(#|\/\/)/.test(text) })),
  );

  // ── Static content ────────────────────────────────────────────────────────
  protected readonly scenarios: readonly {
    action: string;
    state: string;
    tone: Tone;
    event: string;
    validates: string;
  }[] = [
    {
      action: 'confirm',
      state: 'CONFIRMED',
      tone: 'ok',
      event: 'payment.confirmed',
      validates: 'Liberação de acesso, recibo, saldo e fechamento do pedido.',
    },
    {
      action: 'fail',
      state: 'FAILED',
      tone: 'bad',
      event: 'payment.failed',
      validates: 'Mensagem de erro, nova tentativa e carrinho intacto.',
    },
    {
      action: 'expire',
      state: 'EXPIRED',
      tone: 'warn',
      event: 'payment.expired',
      validates: 'Timer, tela de expiração e geração de uma nova cobrança.',
    },
    {
      action: 'replay',
      state: 'IDEMPOTENT',
      tone: 'neutral',
      event: '— nenhum evento —',
      validates: 'Mesma Idempotency-Key devolve o mesmo Payment, nunca dois.',
    },
  ];

  protected readonly steps = [
    {
      n: '01',
      title: 'Gere uma chave TEST',
      body: 'Crie a conta, abra uma loja e saia com um par de chaves. TEST e LIVE ficam isolados desde o primeiro request.',
    },
    {
      n: '02',
      title: 'Crie a cobrança',
      body: 'Um POST /payments devolve QR, copia-e-cola, expiração e recibo. Nenhum banco é acionado no caminho.',
    },
    {
      n: '03',
      title: 'Escolha o final',
      body: 'confirm, fail ou expire. O evento sai pela outbox, o webhook é assinado e sua aplicação reage de verdade.',
    },
  ];

  protected readonly features = [
    {
      icon: 'lucideReceipt',
      title: 'Pix simulado',
      body: 'Cobranças com QR, expiração, taxa e recibo — sem um centavo circulando.',
    },
    {
      icon: 'lucideLink2',
      title: 'Payment Links',
      body: 'Uma URL pública em /pay/:token, pronta para mandar no chat do cliente.',
    },
    {
      icon: 'lucideBoxes',
      title: 'Checkout hospedado',
      body: 'Sessões de checkout com catálogo de produtos ou valor avulso.',
    },
    {
      icon: 'lucideWebhook',
      title: 'Webhooks assinados',
      body: 'HMAC, retry com backoff e fila observável no dashboard.',
    },
    {
      icon: 'lucideRepeat2',
      title: 'Idempotência nativa',
      body: 'Repita o request à vontade: a chave manda, não a sorte da rede.',
    },
    {
      icon: 'lucideWallet',
      title: 'Saques e ledger',
      body: 'Conta bancária, reserva de saldo e liquidação simulada de ponta a ponta.',
    },
  ];

  protected readonly ticker = [
    'payment.created',
    'payment.confirmed',
    'payment.failed',
    'payment.expired',
    'webhook.delivered',
    'withdrawal.settled',
    'receipt.issued',
    'idempotency.replayed',
  ];

  constructor() {
    const destroyRef = inject(DestroyRef);
    const document = inject(DOCUMENT);
    const meta = inject(Meta);

    const onScroll = () => {
      const next = window.scrollY > 12;
      if (next !== this.scrolled()) this.scrolled.set(next);
    };

    // A landing é a única tela escura: o overscroll, a barra de rolagem e a
    // barra do navegador acompanham enquanto ela estiver montada, e voltam depois.
    const root = document.documentElement;
    const previous = {
      background: document.body.style.backgroundColor,
      scheme: root.style.colorScheme,
      themeColor: meta.getTag('name="theme-color"')?.content,
    };

    afterNextRender(() => {
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      document.body.style.backgroundColor = NIGHT;
      root.style.colorScheme = 'dark';
      meta.updateTag({ name: 'theme-color', content: NIGHT });
    });

    destroyRef.onDestroy(() => {
      window.removeEventListener('scroll', onScroll);
      document.body.style.backgroundColor = previous.background;
      root.style.colorScheme = previous.scheme;
      if (previous.themeColor)
        meta.updateTag({ name: 'theme-color', content: previous.themeColor });
      for (const id of this.timers) clearTimeout(id);
      this.timers.clear();
    });
  }

  // ── Code tabs ─────────────────────────────────────────────────────────────

  protected selectTab(id: string): void {
    this.activeTab.set(id);
    this.copied.set(false);
  }

  protected async copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.activeCode());
      this.copied.set(true);
      const id = setTimeout(() => {
        this.timers.delete(id);
        this.copied.set(false);
      }, 1800);
      this.timers.add(id);
    } catch {
      this.copied.set(false);
    }
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  /** Leva o holofote do card até o ponteiro. */
  protected spot(event: PointerEvent): void {
    const card = event.currentTarget as HTMLElement;
    const box = card.getBoundingClientRect();
    card.style.setProperty('--x', `${event.clientX - box.left}px`);
    card.style.setProperty('--y', `${event.clientY - box.top}px`);
  }
}
