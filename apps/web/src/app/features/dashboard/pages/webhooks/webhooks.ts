import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCircleAlert,
  lucideCopy,
  lucideHistory,
  lucideInbox,
  lucideNetwork,
  lucidePlus,
  lucideRefreshCcw,
  lucideSend,
  lucideTrash2,
} from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';
import {
  WebhookConfig,
  WebhookDeliveryStatus,
  WebhookInboxEvent,
  WebhookLog,
  WebhookService,
} from '../../../../core/services/webhook.service';
import {
  CopyValue,
  PageHeader,
  PageState,
  Sheet,
  StatusChip,
  type Tone,
} from '../../../../shared/ui';

type LogFilter = 'all' | 'delivered' | 'failed' | 'pending';

/** Quatro desfechos de entrega, quatro tons. Retentável ainda é esperança. */
const LOG_TONES: Record<WebhookDeliveryStatus, Tone> = {
  PENDING: 'neutral',
  DELIVERED: 'ok',
  FAILED_RETRYABLE: 'warn',
  FAILED_FINAL: 'bad',
};

const LOG_LABELS: Record<WebhookDeliveryStatus, string> = {
  PENDING: 'Pendente',
  DELIVERED: 'Entregue',
  FAILED_RETRYABLE: 'Falha temporária',
  FAILED_FINAL: 'Falha final',
};

const FILTER_LABELS: Record<LogFilter, string> = {
  all: 'Todas',
  delivered: 'Entregues',
  failed: 'Com falha',
  pending: 'Pendentes',
};

@Component({
  selector: 'app-webhooks',
  standalone: true,
  imports: [
    DatePipe,
    NgIcon,
    ReactiveFormsModule,
    CopyValue,
    PageHeader,
    PageState,
    Sheet,
    StatusChip,
  ],
  viewProviders: [
    provideIcons({
      lucideCheck,
      lucideCircleAlert,
      lucideCopy,
      lucideHistory,
      lucideInbox,
      lucideNetwork,
      lucidePlus,
      lucideRefreshCcw,
      lucideSend,
      lucideTrash2,
    }),
  ],
  templateUrl: './webhooks.html',
  styleUrl: './webhooks.css',
})
export class Webhooks implements OnInit {
  private readonly webhookService = inject(WebhookService);

  readonly webhooks = signal<WebhookConfig[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly isCreating = signal(false);
  readonly isCreatingInbox = signal(false);
  readonly newWebhookForm = new FormGroup({
    url: new FormControl('', [Validators.required, Validators.pattern('https?://.+')]),
    events: new FormControl<string[]>([], [Validators.required, Validators.minLength(1)]),
  });

  /**
   * Espelho de `ALLOWED_WEBHOOK_EVENTS` em @hockpay/core, catalogado em
   * `docs/EVENTS.md`. O dashboard nao importa o core (app Angular separado),
   * entao esta lista e mantida a mao -- e tinha ficado para tras: a API aceitava
   * dez eventos enquanto a tela oferecia cinco, e quem quisesse assinar
   * `payment.refunded` ou os `withdrawal.*` tinha que ir pela API.
   */
  readonly availableEvents = [
    { id: 'payment.created', label: 'Pagamento criado' },
    { id: 'payment.confirmed', label: 'Pagamento confirmado' },
    { id: 'payment.failed', label: 'Pagamento falhou' },
    { id: 'payment.expired', label: 'Pagamento expirado' },
    { id: 'payment.released', label: 'Repasse liberado' },
    { id: 'payment.refunded', label: 'Pagamento estornado' },
    { id: 'payment_link.created', label: 'Link criado' },
    { id: 'payment_link.paid', label: 'Link pago' },
    { id: 'payment_link.expired', label: 'Link expirado' },
    { id: 'payment_link.cancelled', label: 'Link cancelado' },
    { id: 'withdrawal.created', label: 'Saque solicitado' },
    { id: 'withdrawal.processing', label: 'Saque em processamento' },
    { id: 'withdrawal.completed', label: 'Saque concluido' },
    { id: 'withdrawal.failed', label: 'Saque falhou' },
  ];

  readonly logStatusOptions: LogFilter[] = ['all', 'delivered', 'failed', 'pending'];

  readonly createDialogState = signal<'closed' | 'open'>('closed');

  readonly newSecret = signal('');
  readonly copied = signal(false);
  readonly secretDialogState = signal<'closed' | 'open'>('closed');

  readonly hookToTest = signal<WebhookConfig | null>(null);
  readonly testDialogState = signal<'closed' | 'open'>('closed');
  readonly isTesting = signal(false);

  readonly hookToDelete = signal<WebhookConfig | null>(null);
  readonly deleteDialogState = signal<'closed' | 'open'>('closed');
  readonly isDeleting = signal(false);

  readonly logsDialogState = signal<'closed' | 'open'>('closed');
  readonly hookForLogs = signal<WebhookConfig | null>(null);
  readonly webhookLogs = signal<WebhookLog[]>([]);
  readonly logsStatus = signal<LogFilter>('all');
  readonly logsTotal = signal(0);
  readonly isLogsLoading = signal(false);
  readonly logsError = signal<string | null>(null);
  readonly isRetrying = signal<{ [logId: string]: boolean }>({});

  readonly inboxDialogState = signal<'closed' | 'open'>('closed');
  readonly hookForInbox = signal<WebhookConfig | null>(null);
  readonly inboxEvents = signal<WebhookInboxEvent[]>([]);
  readonly inboxTotal = signal(0);
  readonly isInboxLoading = signal(false);
  readonly inboxError = signal<string | null>(null);

  ngOnInit() {
    this.loadWebhooks();
  }

  openCreateDialog() {
    this.createDialogState.set('open');
  }

  closeCreateDialog() {
    if (this.isCreating()) return;
    this.createDialogState.set('closed');
    this.newWebhookForm.reset({ events: [] });
  }

  closeSecretDialog() {
    this.secretDialogState.set('closed');
    this.newSecret.set('');
    this.copied.set(false);
  }

  isEventSelected(eventId: string): boolean {
    return (this.newWebhookForm.controls.events.value ?? []).includes(eventId);
  }

  toggleEventSelection(eventId: string) {
    const control = this.newWebhookForm.controls.events;
    const current = control.value ?? [];

    control.setValue(
      current.includes(eventId)
        ? current.filter((event) => event !== eventId)
        : [...current, eventId],
    );
    control.markAsTouched();
  }

  createWebhook() {
    if (this.newWebhookForm.invalid) return;

    this.isCreating.set(true);
    const { url, events } = this.newWebhookForm.value;

    this.webhookService.create({ url: url!, events: events! }).subscribe({
      next: (response) => {
        this.isCreating.set(false);
        this.newWebhookForm.reset({ events: [] });

        const { secret, ...config } = response;
        this.webhooks.update((hooks) => [config as WebhookConfig, ...hooks]);

        this.newSecret.set(secret);
        this.copied.set(false);
        this.createDialogState.set('closed');
        this.secretDialogState.set('open');
      },
      error: () => {
        this.isCreating.set(false);
        toast.error('Falha ao criar o webhook. Confira a URL e tente de novo.');
      },
    });
  }

  createInboxWebhook() {
    if (this.isCreatingInbox()) return;

    this.isCreatingInbox.set(true);
    this.webhookService.createInbox().subscribe({
      next: (response) => {
        this.isCreatingInbox.set(false);
        const { secret, ...config } = response;
        this.webhooks.update((hooks) => [config as WebhookConfig, ...hooks]);
        this.newSecret.set(secret);
        this.copied.set(false);
        this.secretDialogState.set('open');
      },
      error: () => {
        this.isCreatingInbox.set(false);
        toast.error('Falha ao criar o inbox de teste.');
      },
    });
  }

  copyToClipboard() {
    const secret = this.newSecret();
    if (!secret) return;

    void navigator.clipboard?.writeText(secret);
    this.copied.set(true);
    window.setTimeout(() => this.copied.set(false), 3000);
  }

  openTestDialog(hook: WebhookConfig) {
    this.hookToTest.set(hook);
    this.testDialogState.set('open');
  }

  closeTestDialog() {
    if (this.isTesting()) return;
    this.testDialogState.set('closed');
    window.setTimeout(() => this.hookToTest.set(null), 200);
  }

  testWebhook() {
    const hook = this.hookToTest();
    if (!hook) return;

    this.isTesting.set(true);
    this.webhookService.test(hook.id).subscribe({
      next: () => {
        this.isTesting.set(false);
        this.closeTestDialog();
      },
      error: () => {
        this.isTesting.set(false);
        this.closeTestDialog();
        toast.error('O ping não saiu. O endpoint pode estar fora do ar.');
      },
    });
  }

  openDeleteDialog(hook: WebhookConfig) {
    this.hookToDelete.set(hook);
    this.deleteDialogState.set('open');
  }

  closeDeleteDialog() {
    if (this.isDeleting()) return;
    this.deleteDialogState.set('closed');
    window.setTimeout(() => this.hookToDelete.set(null), 200);
  }

  deleteWebhook() {
    const hook = this.hookToDelete();
    if (!hook) return;

    this.isDeleting.set(true);
    this.webhookService.delete(hook.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.deleteDialogState.set('closed');
        this.hookToDelete.set(null);
        this.loadWebhooks();
      },
      error: () => {
        this.isDeleting.set(false);
        toast.error('Falha ao excluir o webhook.');
      },
    });
  }

  openLogsDialog(hook: WebhookConfig) {
    this.hookForLogs.set(hook);
    this.logsStatus.set('all');
    this.logsDialogState.set('open');
    this.loadLogs(hook.id);
  }

  closeLogsDialog() {
    this.logsDialogState.set('closed');
    window.setTimeout(() => {
      this.hookForLogs.set(null);
      this.webhookLogs.set([]);
      this.logsTotal.set(0);
    }, 200);
  }

  openInboxDialog(hook: WebhookConfig) {
    this.hookForInbox.set(hook);
    this.inboxDialogState.set('open');
    this.loadInboxEvents(hook.id);
  }

  closeInboxDialog() {
    this.inboxDialogState.set('closed');
    window.setTimeout(() => {
      this.hookForInbox.set(null);
      this.inboxEvents.set([]);
      this.inboxTotal.set(0);
    }, 200);
  }

  loadInboxEvents(hookId: string) {
    this.isInboxLoading.set(true);
    this.inboxError.set(null);
    this.inboxEvents.set([]);
    this.inboxTotal.set(0);

    this.webhookService.listInboxEvents(hookId, { limit: 50 }).subscribe({
      next: (response) => {
        this.inboxEvents.set(response.events);
        this.inboxTotal.set(response.total);
        this.isInboxLoading.set(false);
      },
      error: () => {
        this.inboxError.set('Falha ao carregar os eventos recebidos.');
        this.isInboxLoading.set(false);
      },
    });
  }

  refreshInboxEvents() {
    const hook = this.hookForInbox();
    if (hook) this.loadInboxEvents(hook.id);
  }

  loadLogs(hookId: string) {
    this.isLogsLoading.set(true);
    this.logsError.set(null);
    this.webhookLogs.set([]);
    this.logsTotal.set(0);

    const selected = this.logsStatus();
    const params: { limit: number; status?: 'delivered' | 'failed' | 'pending' } = { limit: 50 };
    if (selected !== 'all') params.status = selected;

    this.webhookService.listLogs(hookId, params).subscribe({
      next: (response) => {
        this.webhookLogs.set(response.logs);
        this.logsTotal.set(response.total);
        this.isLogsLoading.set(false);
      },
      error: () => {
        this.logsError.set('Falha ao carregar o histórico de envios.');
        this.isLogsLoading.set(false);
      },
    });
  }

  setLogsStatus(status: LogFilter) {
    this.logsStatus.set(status);
    const hook = this.hookForLogs();
    if (hook) this.loadLogs(hook.id);
  }

  logStatusLabel(status: LogFilter): string {
    return FILTER_LABELS[status];
  }

  shortId(value?: string): string {
    if (!value) return '—';
    return value.length > 12 ? `${value.slice(0, 8)}…` : value;
  }

  isInboxWebhook(hook?: WebhookConfig | null): boolean {
    return Boolean(hook?.url.includes('/api/v1/dev/webhook-inbox/'));
  }

  /**
   * O circuito abre quando o destino falha por transporte varias vezes seguidas
   * -- endpoint fora do ar, tunel de dev caido, proxy pendurado. Enquanto
   * estiver aberto nenhuma entrega e tentada, entao a tela precisa dizer isso
   * em vez de deixar o lojista achar que parou de acontecer evento.
   */
  isCircuitOpen(hook?: WebhookConfig | null): boolean {
    return hook?.circuit?.state === 'open';
  }

  circuitDetail(hook?: WebhookConfig | null): string {
    const circuit = hook?.circuit;
    if (!circuit || circuit.state !== 'open') return '';

    const failures = `${circuit.consecutiveFailures} ${
      circuit.consecutiveFailures === 1 ? 'falha seguida' : 'falhas seguidas'
    }`;
    if (!circuit.openUntil) return failures;

    const retryAt = new Date(circuit.openUntil);
    if (Number.isNaN(retryAt.getTime())) return failures;

    const time = retryAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${failures} · nova tentativa às ${time}`;
  }

  circuitTitle(hook?: WebhookConfig | null): string {
    return this.isCircuitOpen(hook)
      ? 'O destino não respondeu às últimas tentativas. As entregas voltam sozinhas quando ele responder.'
      : '';
  }

  /**
   * A API nem sempre manda `status`. Quando falta, o desfecho é reconstruído
   * a partir do que sobrou: resposta HTTP, carimbo de entrega, erro, tentativa.
   */
  resolveLogStatus(log: WebhookLog): WebhookDeliveryStatus {
    if (this.isWebhookDeliveryStatus(log.status)) {
      return log.status;
    }

    if (log.deliveredAt || this.isSuccessfulResponse(log.responseStatus)) {
      return 'DELIVERED';
    }

    if (
      log.failedAt ||
      log.lastError ||
      this.isFailedResponse(log.responseStatus) ||
      this.isLegacyAttemptedWithoutResponse(log)
    ) {
      return log.attempt >= log.maxAttempts ? 'FAILED_FINAL' : 'FAILED_RETRYABLE';
    }

    return 'PENDING';
  }

  getLogStatusLabel(log: WebhookLog): string {
    return LOG_LABELS[this.resolveLogStatus(log)];
  }

  getLogStatusTone(log: WebhookLog): Tone {
    return LOG_TONES[this.resolveLogStatus(log)];
  }

  getLogStatusDetail(log: WebhookLog): string {
    const status = this.resolveLogStatus(log);
    const responseDetail =
      log.responseStatus !== undefined ? `HTTP ${log.responseStatus}` : 'sem resposta HTTP';

    if (status === 'PENDING') return 'Aguardando processamento.';
    if (status === 'DELIVERED') {
      return log.responseStatus !== undefined
        ? `${responseDetail}, entregue.`
        : 'Entrega confirmada.';
    }

    if (log.lastError) return log.lastError;

    return status === 'FAILED_RETRYABLE'
      ? `${responseDetail}. Ainda há nova tentativa automática.`
      : `${responseDetail}. Só reenviando à mão.`;
  }

  canRetryLog(log: WebhookLog): boolean {
    const status = this.resolveLogStatus(log);
    return status === 'FAILED_RETRYABLE' || status === 'FAILED_FINAL';
  }

  prettyJson(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }

  retryLog(log: WebhookLog) {
    if (!this.canRetryLog(log)) return;

    this.isRetrying.update((state) => ({ ...state, [log.id]: true }));

    this.webhookService.retryLog(log.configId, log.id).subscribe({
      next: () => {
        this.isRetrying.update((state) => ({ ...state, [log.id]: false }));
        this.loadLogs(log.configId);
      },
      error: () => {
        this.isRetrying.update((state) => ({ ...state, [log.id]: false }));
        toast.error('Falha ao reenviar esse evento.');
      },
    });
  }

  loadWebhooks() {
    this.isLoading.set(true);
    this.error.set(null);
    this.webhooks.set([]);

    this.webhookService.list().subscribe({
      next: (response) => {
        this.webhooks.set(response.webhooks);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('O servidor não respondeu. Tente de novo em instantes.');
        this.isLoading.set(false);
      },
    });
  }

  private isWebhookDeliveryStatus(status: unknown): status is WebhookDeliveryStatus {
    return (
      status === 'PENDING' ||
      status === 'DELIVERED' ||
      status === 'FAILED_RETRYABLE' ||
      status === 'FAILED_FINAL'
    );
  }

  private isSuccessfulResponse(status?: number): boolean {
    return status !== undefined && status >= 200 && status < 300;
  }

  private isFailedResponse(status?: number): boolean {
    return status !== undefined && status >= 300;
  }

  private isLegacyAttemptedWithoutResponse(log: WebhookLog): boolean {
    return log.responseStatus === undefined && log.attempt > 0;
  }
}
