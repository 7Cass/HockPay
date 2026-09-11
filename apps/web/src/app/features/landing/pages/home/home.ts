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
import { Reveal } from '../../../../shared/directives/reveal';
import { ApiShowcase } from '../../components/api-showcase/api-showcase';
import { CustomCursor } from '../../components/custom-cursor/custom-cursor';
import { FeatureTiles } from '../../components/feature-tiles/feature-tiles';
import { PaymentSimulator, SimStatus } from '../../components/payment-simulator/payment-simulator';
import { PinnedSteps, Step } from '../../components/pinned-steps/pinned-steps';
import { Scenario, ScenarioList } from '../../components/scenario-list/scenario-list';
import { ScrollWords } from '../../components/scroll-words/scroll-words';
import { SiteFooter } from '../../components/site-footer/site-footer';
import { VelocityMarquee } from '../../components/velocity-marquee/velocity-marquee';
import { MOODS, blobPath } from '../../motion/blob';
import { Magnetic } from '../../motion/magnetic';

const CHARGE_ID = 'pay_3f8Ka92LmQ';

/** O chão da landing; o resto do produto segue no papel claro. */
const NIGHT = '#11110f';

/** A página toma a cor do desfecho escolhido no simulador. */
const ACCENTS: Record<SimStatus, string> = {
  idle: 'var(--color-bone)',
  pending: 'var(--color-bone)',
  confirmed: 'var(--color-ok-bright)',
  failed: 'var(--color-bad-bright)',
  expired: 'var(--color-warn-bright)',
};

/** A última linha do título: como a cobrança terminou, ou a promessa enquanto não termina. */
const ENDINGS: Record<SimStatus, string> = {
  idle: 'como você mandar.',
  pending: 'como você mandar.',
  confirmed: 'confirmado.',
  failed: 'recusado.',
  expired: 'expirado.',
};

/** Para onde cada letra de "Quebre" voa no hover: [x, y, giro]. */
const SHARDS: readonly (readonly [number, number, number])[] = [
  [-8, -16, -14],
  [5, 12, 10],
  [-4, -22, -7],
  [9, 8, 16],
  [-12, 14, -11],
  [6, -12, 8],
];

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    Reveal,
    Magnetic,
    ApiShowcase,
    CustomCursor,
    FeatureTiles,
    PaymentSimulator,
    PinnedSteps,
    ScenarioList,
    ScrollWords,
    SiteFooter,
    VelocityMarquee,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  // ── Estado que pinta a página ─────────────────────────────────────────────
  protected readonly status = signal<SimStatus>('idle');
  protected readonly accent = computed(() => ACCENTS[this.status()]);
  protected readonly ending = computed(() => ENDINGS[this.status()]);
  protected readonly endingWords = computed(() =>
    this.ending()
      .split(' ')
      .map((word) => Array.from(word)),
  );

  // ── Navegação ─────────────────────────────────────────────────────────────
  protected readonly scrolled = signal(false);
  protected readonly navHidden = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly clock = signal('');

  protected readonly navLinks = [
    { href: '#simulador', label: 'Simulador' },
    { href: '#cenarios', label: 'Cenários' },
    { href: '#api', label: 'API' },
    { href: '#recursos', label: 'Recursos' },
  ] as const;

  /** A marca: um organismo pequeno, parado, na cor da página. */
  protected readonly mark = blobPath(MOODS.confirmed, 0.8, 11);

  // ── Conteúdo ──────────────────────────────────────────────────────────────
  protected readonly lead = ['Todo', 'pagamento', 'termina'];

  protected readonly marquee = [
    'confirmado',
    'recusado',
    'expirado',
    'idempotente',
    'assinado',
    'reentregue',
  ];

  protected readonly manifesto =
    'HockPay é um gateway Pix *simulado.* Você cria a cobrança e escolhe o desfecho — ' +
    '*confirmada,* *recusada* ou *expirada.* Webhook, idempotência, taxa e ledger se ' +
    'comportam como em produção. O dinheiro é que *não* *existe.*';

  protected readonly scenarios: readonly Scenario[] = [
    {
      action: 'confirm',
      state: 'Confirmado',
      tone: 'ok',
      event: 'payment.confirmed',
      validates: 'Liberação de acesso, recibo, saldo e fechamento do pedido.',
      payload: `{
  "event": "payment.confirmed",
  "data": {
    "id": "${CHARGE_ID}",
    "status": "CONFIRMED",
    "net": 24850
  }
}`,
    },
    {
      action: 'fail',
      state: 'Recusado',
      tone: 'bad',
      event: 'payment.failed',
      validates: 'Mensagem de erro, nova tentativa e carrinho intacto.',
      payload: `{
  "event": "payment.failed",
  "data": {
    "id": "${CHARGE_ID}",
    "status": "FAILED",
    "reason": "insufficient_funds"
  }
}`,
    },
    {
      action: 'expire',
      state: 'Expirado',
      tone: 'warn',
      event: 'payment.expired',
      validates: 'Timer, tela de expiração e geração de uma nova cobrança.',
      payload: `{
  "event": "payment.expired",
  "data": {
    "id": "${CHARGE_ID}",
    "status": "EXPIRED",
    "charged": 0
  }
}`,
    },
    {
      action: 'replay',
      state: 'Idempotente',
      tone: 'neutral',
      event: 'nenhum evento novo',
      validates: 'Mesma Idempotency-Key devolve o mesmo Payment, nunca dois.',
      payload: `HTTP/1.1 200 OK
Idempotency-Replayed: true

{ "id": "${CHARGE_ID}" }`,
    },
  ];

  protected readonly steps: readonly Step[] = [
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

  protected readonly shards = Array.from('Quebre', (ch, i) => ({
    ch,
    x: `${SHARDS[i][0]}px`,
    y: `${SHARDS[i][1]}px`,
    r: `${SHARDS[i][2]}deg`,
  }));

  constructor() {
    const destroyRef = inject(DestroyRef);
    const document = inject(DOCUMENT);
    const meta = inject(Meta);
    let lastY = 0;
    let ticker: ReturnType<typeof setInterval> | undefined;

    const onScroll = () => {
      const y = window.scrollY;
      this.scrolled.set(y > 12);
      if (Math.abs(y - lastY) > 6) {
        this.navHidden.set(y > lastY && y > 160 && !this.menuOpen());
        lastY = y;
      }
    };

    // A landing é a única tela escura: o overscroll, a barra de rolagem e a
    // barra do navegador acompanham enquanto ela estiver montada, e voltam depois.
    const root = document.documentElement;
    const previous = {
      background: document.body.style.backgroundColor,
      scheme: root.style.colorScheme,
      themeColor: meta.getTag('name="theme-color"')?.content,
    };

    const tell = () =>
      this.clock.set(
        new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false }),
      );

    afterNextRender(() => {
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      document.body.style.backgroundColor = NIGHT;
      root.style.colorScheme = 'dark';
      meta.updateTag({ name: 'theme-color', content: NIGHT });
      tell();
      ticker = setInterval(tell, 1000);
    });

    destroyRef.onDestroy(() => {
      window.removeEventListener('scroll', onScroll);
      clearInterval(ticker);
      document.body.style.backgroundColor = previous.background;
      root.style.colorScheme = previous.scheme;
      if (previous.themeColor)
        meta.updateTag({ name: 'theme-color', content: previous.themeColor });
    });
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }
}
