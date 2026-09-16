import { Component, computed, inject, linkedSignal, signal } from '@angular/core';

import {
  type Webhook,
  type WebhookLog,
  inboxEventsResource,
  integrationCommands,
  webhookLogsResource,
  webhooksResource,
} from '../../data/integration';
import { MerchantSession } from '../../data/session';
import { toApiFailure } from '../../domain/api-error';
import {
  canRetry,
  circuitExplanation,
  deliveryOutcome,
  outcomeLabel,
  outcomeTone,
} from '../../domain/delivery';
import { eventLabel, eventSummary } from '../../domain/webhook-events';
import {
  MerButton,
  MerChip,
  MerCopy,
  MerEventPicker,
  MerField,
  MerNotice,
  MerPageHeader,
  MerPageState,
  MerPanel,
  MerSheet,
  MerTable,
  MerToastService,
} from '../../ui';

const OUTCOMES = [
  { value: '', label: 'Todos os desfechos' },
  { value: 'DELIVERED', label: 'Entregues' },
  { value: 'PENDING', label: 'Na fila' },
  { value: 'FAILED_RETRYABLE', label: 'Vão tentar de novo' },
  { value: 'FAILED_FINAL', label: 'Falharam de vez' },
];

/**
 * Webhooks: para onde o HockPay avisa que algo aconteceu.
 *
 * A tela é mestre-detalhe porque a pergunta que traz alguém aqui quase nunca é
 * "quais destinos eu tenho" — é "por que o meu endpoint não recebeu o
 * pagamento das 14h". Então a lista fica de lado e o espaço é da investigação:
 * as entregas do destino escolhido, com o desfecho de cada uma, o código HTTP
 * que voltou e o erro que o endpoint devolveu.
 *
 * Duas coisas que a tela antiga não dizia e esta diz:
 *
 * - **o circuito aberto**, em uma frase. Depois de muitas falhas seguidas a API
 *   pausa as entregas daquele destino. Sem explicação, "nenhuma entrega nova"
 *   se parece com "o HockPay parou de emitir eventos".
 * - **o desfecho quando a API não manda `status`** — reconstruído em
 *   `domain/delivery`, em vez de virar um traço na coluna.
 */
@Component({
  selector: 'app-console-webhooks',
  standalone: true,
  imports: [
    MerButton,
    MerChip,
    MerCopy,
    MerEventPicker,
    MerField,
    MerNotice,
    MerPageHeader,
    MerPageState,
    MerPanel,
    MerSheet,
    MerTable,
  ],
  templateUrl: './webhooks.html',
  styleUrl: './webhooks.css',
})
export class ConsoleWebhooks {
  private readonly commands = integrationCommands();
  private readonly toast = inject(MerToastService);

  protected readonly session = inject(MerchantSession);
  protected readonly hooks = webhooksResource();
  protected readonly outcomes = OUTCOMES;

  protected readonly list = computed(() => this.hooks.value().webhooks);

  /**
   * O destino em foco. Segue a lista: quando ela recarrega, mantém a escolha
   * se ela ainda existe, e cai no primeiro quando o destino escolhido sumiu
   * (foi o que acabou de ser excluído).
   */
  protected readonly selectedId = linkedSignal<readonly Webhook[], string>({
    source: () => this.list(),
    computation: (list, previous) =>
      list.find((hook) => hook.id === previous?.value)?.id ?? list[0]?.id ?? '',
  });

  protected readonly selected = computed(
    () => this.list().find((hook) => hook.id === this.selectedId()) ?? null,
  );

  protected readonly tab = signal<'deliveries' | 'received'>('deliveries');
  protected readonly outcome = signal('');

  /* Cada aba busca só o que mostra: abrir a tela não pede a inbox de um
     destino que nem é o de teste. */
  private readonly logTarget = computed(() =>
    this.tab() === 'deliveries' ? this.selectedId() : '',
  );
  private readonly inboxTarget = computed(() =>
    this.tab() === 'received' ? this.selectedId() : '',
  );

  protected readonly logs = webhookLogsResource(this.logTarget, this.outcome);
  protected readonly inbox = inboxEventsResource(this.inboxTarget);

  protected readonly circuit = computed(() => circuitExplanation(this.selected()?.circuit));

  protected readonly failure = computed(() => {
    const error = this.hooks.error();
    return error ? toApiFailure(error) : null;
  });

  protected readonly isEmpty = computed(() => !this.hooks.isLoading() && this.list().length === 0);

  /* ── Novo destino ───────────────────────────────────────────────────── */
  protected readonly sheetOpen = signal(false);
  protected readonly url = signal('');
  protected readonly events = signal<readonly string[]>([]);
  protected readonly creating = signal(false);
  protected readonly formError = signal('');

  /** O segredo de assinatura, que a API entrega uma vez só. */
  protected readonly secret = signal('');

  /* ── Ações ──────────────────────────────────────────────────────────── */
  protected readonly busy = signal('');
  protected readonly removing = signal<Webhook | null>(null);

  protected openSheet(): void {
    this.url.set('');
    this.events.set([]);
    this.formError.set('');
    this.sheetOpen.set(true);
  }

  protected closeSheet(): void {
    if (this.creating()) return;
    this.sheetOpen.set(false);
  }

  protected async create(): Promise<void> {
    const url = this.url().trim();

    if (!url) {
      this.formError.set('Cole a URL que vai receber as entregas.');
      return;
    }
    if (!/^https:\/\//i.test(url)) {
      this.formError.set('A URL precisa ser https: a entrega vai assinada, mas não vai em claro.');
      return;
    }
    if (this.events().length === 0) {
      this.formError.set('Escolha pelo menos um evento para receber.');
      return;
    }

    this.creating.set(true);
    const result = await this.commands.createWebhook({ url, events: this.events() });
    this.creating.set(false);

    if (!result.ok) {
      this.formError.set(result.failure.message);
      return;
    }

    this.secret.set(result.value.secret);
    this.sheetOpen.set(false);
    this.toast.ok('Destino criado.', 'Guarde o segredo de assinatura agora.');
    this.hooks.reload();
  }

  /** O destino de teste da própria API: entrega assinada que volta para cá. */
  protected async createInbox(): Promise<void> {
    if (this.busy()) return;

    this.busy.set('inbox');
    const result = await this.commands.createInbox();
    this.busy.set('');

    if (!result.ok) {
      this.toast.bad('Não foi possível criar a caixa de teste.', result.failure.message);
      return;
    }

    this.secret.set(result.value.secret);
    this.toast.ok(
      'Caixa de teste criada.',
      'Dispare um teste e veja a entrega chegar na aba Recebidos.',
    );
    this.hooks.reload();
  }

  protected dismissSecret(): void {
    this.secret.set('');
  }

  protected async test(hook: Webhook): Promise<void> {
    if (this.busy()) return;

    this.busy.set(hook.id);
    const result = await this.commands.testWebhook(hook.id);
    this.busy.set('');

    if (!result.ok) {
      this.toast.bad('O disparo de teste não saiu.', result.failure.message);
      return;
    }

    this.toast.ok('Teste disparado.', 'O desfecho aparece nas entregas em alguns segundos.');
    this.logs.reload();
  }

  protected async toggle(hook: Webhook): Promise<void> {
    if (this.busy()) return;

    this.busy.set(hook.id);
    const result = await this.commands.setWebhookActive(hook.id, !hook.isActive);
    this.busy.set('');

    if (!result.ok) {
      this.toast.bad('Não foi possível mudar o destino.', result.failure.message);
      return;
    }

    this.toast.info(hook.isActive ? 'Destino pausado.' : 'Destino reativado.');
    this.hooks.reload();
  }

  protected async remove(): Promise<void> {
    const hook = this.removing();
    if (!hook || this.busy()) return;

    this.busy.set(hook.id);
    const result = await this.commands.deleteWebhook(hook.id);
    this.busy.set('');

    if (!result.ok) {
      this.toast.bad('Não foi possível excluir o destino.', result.failure.message);
      return;
    }

    this.removing.set(null);
    this.toast.ok('Destino excluído.');
    this.hooks.reload();
  }

  protected async retry(log: WebhookLog): Promise<void> {
    const id = this.selectedId();
    if (!id || this.busy()) return;

    this.busy.set(log.id);
    const result = await this.commands.retryDelivery(id, log.id);
    this.busy.set('');

    if (!result.ok) {
      this.toast.bad('Não foi possível reenviar.', result.failure.message);
      return;
    }

    this.toast.ok('Reenvio pedido.', 'A nova tentativa entra na fila agora.');
    this.logs.reload();
  }

  protected select(id: string): void {
    this.selectedId.set(id);
  }

  protected setOutcome(value: string): void {
    this.outcome.set(value);
  }

  protected setTab(tab: 'deliveries' | 'received'): void {
    this.tab.set(tab);
  }

  protected setEvents(events: readonly string[]): void {
    this.events.set(events);
    this.formError.set('');
  }

  protected reload(): void {
    this.hooks.reload();
    this.logs.reload();
    this.inbox.reload();
  }

  /* ── Tradução ───────────────────────────────────────────────────────── */
  protected outcomeOf = deliveryOutcome;
  protected labelOf = outcomeLabel;
  protected toneOf = outcomeTone;
  protected retriable = canRetry;
  protected eventName = eventLabel;
  protected summaryOf = eventSummary;

  /** O host da URL, que é o que identifica o destino de relance. */
  protected host(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }

  protected path(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.pathname + parsed.search;
    } catch {
      return '';
    }
  }

  protected when(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
