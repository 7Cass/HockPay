import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import {
  WebhookService,
  WebhookConfig,
  WebhookDeliveryStatus,
  WebhookInboxEvent,
  WebhookLog,
} from '../../../../core/services/webhook.service';
import { DialogImports } from '../../../../shared/components/dialog/dialog.component';

// Spartan UI
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { toast } from 'ngx-sonner';

// Icons
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import {
  lucideRefreshCcw,
  lucidePlus,
  lucideTrash2,
  lucideNetwork,
  lucideXCircle,
  lucideTestTubeDiagonal,
  lucideHistory,
  lucideCopy,
  lucideAlertTriangle,
  lucideCheck,
  lucideClock,
} from '@ng-icons/lucide';

@Component({
  selector: 'app-webhooks',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    // UI Components
    ...HlmButtonImports,
    ...HlmTableImports,
    ...HlmBadgeImports,
    ...HlmSpinnerImports,
    NgIconComponent,
    HlmIconImports,
    ...DialogImports,
  ],
  viewProviders: [
    provideIcons({
      lucideRefreshCcw,
      lucidePlus,
      lucideTrash2,
      lucideNetwork,
      lucideXCircle,
      lucideTestTubeDiagonal,
      lucideHistory,
      lucideCopy,
      lucideAlertTriangle,
      lucideCheck,
      lucideClock,
    }),
  ],
  templateUrl: './webhooks.html',
})
export class Webhooks implements OnInit {
  private readonly webhookService = inject(WebhookService);

  // State Signals
  webhooks = signal<WebhookConfig[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  // Creation State
  isCreating = signal<boolean>(false);
  isCreatingInbox = signal<boolean>(false);
  newWebhookForm = new FormGroup({
    url: new FormControl('', [Validators.required, Validators.pattern('https?://.+')]),
    events: new FormControl<string[]>([], [Validators.required, Validators.minLength(1)]),
  });

  availableEvents = [
    { id: 'payment.created', label: 'Pagamento criado' },
    { id: 'payment.confirmed', label: 'Pagamento confirmado' },
    { id: 'payment.failed', label: 'Pagamento falhou' },
    { id: 'payment.expired', label: 'Pagamento expirado' },
    { id: 'payment.released', label: 'Repasse liberado' },
  ];

  logStatusOptions: Array<'all' | 'delivered' | 'failed' | 'pending'> = [
    'all',
    'delivered',
    'failed',
    'pending',
  ];

  createDialogState = signal<'closed' | 'open'>('closed');

  // Secret Modal State
  newSecret = signal<string>('');
  copied = signal<boolean>(false);
  secretDialogState = signal<'closed' | 'open'>('closed');

  // Test State
  hookToTest = signal<WebhookConfig | null>(null);
  testDialogState = signal<'closed' | 'open'>('closed');
  isTesting = signal<boolean>(false);

  // Delete State
  hookToDelete = signal<WebhookConfig | null>(null);
  deleteDialogState = signal<'closed' | 'open'>('closed');
  isDeleting = signal<boolean>(false);

  // Logs State
  logsDialogState = signal<'closed' | 'open'>('closed');
  hookForLogs = signal<WebhookConfig | null>(null);
  webhookLogs = signal<WebhookLog[]>([]);
  logsStatus = signal<'all' | 'delivered' | 'failed' | 'pending'>('all');
  logsTotal = signal(0);
  isLogsLoading = signal<boolean>(false);
  logsError = signal<string | null>(null);
  isRetrying = signal<{ [logId: string]: boolean }>({});

  inboxDialogState = signal<'closed' | 'open'>('closed');
  hookForInbox = signal<WebhookConfig | null>(null);
  inboxEvents = signal<WebhookInboxEvent[]>([]);
  inboxTotal = signal(0);
  isInboxLoading = signal<boolean>(false);
  inboxError = signal<string | null>(null);

  ngOnInit() {
    this.loadWebhooks();
  }

  // Dialog Toggles
  openCreateDialog() {
    this.createDialogState.set('open');
  }

  closeCreateDialog() {
    this.createDialogState.set('closed');
    this.newWebhookForm.reset({ events: [] });
  }

  closeSecretDialog() {
    this.secretDialogState.set('closed');
  }

  toggleEventSelection(eventId: string) {
    const eventsControl = this.newWebhookForm.get('events');
    const currentEvents = eventsControl?.value || [];

    if (currentEvents.includes(eventId)) {
      eventsControl?.setValue(currentEvents.filter((e) => e !== eventId));
    } else {
      eventsControl?.setValue([...currentEvents, eventId]);
    }
  }

  createWebhook() {
    if (this.newWebhookForm.invalid) return;

    this.isCreating.set(true);
    const { url, events } = this.newWebhookForm.value;

    this.webhookService.create({ url: url!, events: events! }).subscribe({
      next: (response) => {
        this.isCreating.set(false);
        this.newWebhookForm.reset({ events: [] });

        // Push locally without the one-time secret
        const createdConfig: WebhookConfig = { ...response, secret: undefined } as any;
        this.webhooks.update((hooks) => [createdConfig, ...hooks]);

        this.newSecret.set(response.secret);
        this.copied.set(false);

        // Transition from Create to Secret Modal
        this.createDialogState.set('closed');
        this.secretDialogState.set('open');
      },
      error: (err) => {
        this.isCreating.set(false);
        console.error('Failed to create webhook', err);
        toast.error('Falha ao criar webhook. Verifique os dados e tente novamente.');
      },
    });
  }

  createInboxWebhook() {
    if (this.isCreatingInbox()) return;

    this.isCreatingInbox.set(true);
    this.webhookService.createInbox().subscribe({
      next: (response) => {
        this.isCreatingInbox.set(false);
        const createdConfig: WebhookConfig = { ...response, secret: undefined } as any;
        this.webhooks.update((hooks) => [createdConfig, ...hooks]);
        this.newSecret.set(response.secret);
        this.copied.set(false);
        this.secretDialogState.set('open');
      },
      error: (err) => {
        this.isCreatingInbox.set(false);
        console.error('Failed to create webhook inbox', err);
        toast.error('Falha ao criar inbox de teste.');
      },
    });
  }

  copyToClipboard() {
    if (!this.newSecret()) return;

    navigator.clipboard.writeText(this.newSecret()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 3000);
    });
  }

  // --- ACTIONS (Test and Delete) ---

  openTestDialog(hook: WebhookConfig) {
    this.hookToTest.set(hook);
    this.testDialogState.set('open');
  }

  closeTestDialog() {
    this.testDialogState.set('closed');
    setTimeout(() => this.hookToTest.set(null), 200);
  }

  testWebhook() {
    const hook = this.hookToTest();
    if (!hook) return;

    this.isTesting.set(true);
    this.webhookService.test(hook.id).subscribe({
      next: () => {
        this.isTesting.set(false);
        this.closeTestDialog();
        // Fire & Forget: test done. Note: Logs will show outcome if they check the history list.
      },
      error: (err) => {
        this.isTesting.set(false);
        console.error('Failed test webhook', err);
        // We still close normally, as the log will register the attempt error,
        // but we can notify the user.
        toast.error('Falha ao disparar o ping de teste. O endpoint pode estar inacessível.');
      },
    });
  }

  openDeleteDialog(hook: WebhookConfig) {
    this.hookToDelete.set(hook);
    this.deleteDialogState.set('open');
  }

  closeDeleteDialog() {
    this.deleteDialogState.set('closed');
    setTimeout(() => this.hookToDelete.set(null), 200);
  }

  deleteWebhook() {
    const hook = this.hookToDelete();
    if (!hook) return;

    this.isDeleting.set(true);
    this.webhookService.delete(hook.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.closeDeleteDialog();
        this.loadWebhooks(); // Refresh list entirely
      },
      error: (err) => {
        this.isDeleting.set(false);
        console.error('Failed to delete webhook', err);
        toast.error('Falha ao excluir webhook.');
      },
    });
  }

  // --- LOGS (Delivery History) ---
  openLogsDialog(hook: WebhookConfig) {
    this.hookForLogs.set(hook);
    this.logsStatus.set('all');
    this.logsDialogState.set('open');
    this.loadLogs(hook.id);
  }

  closeLogsDialog() {
    this.logsDialogState.set('closed');
    setTimeout(() => {
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
    setTimeout(() => {
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
      error: (err) => {
        console.error('Failed to load webhook inbox events', err);
        this.inboxError.set('Falha ao carregar os eventos recebidos.');
        this.isInboxLoading.set(false);
      },
    });
  }

  refreshInboxEvents() {
    const hook = this.hookForInbox();
    if (hook) {
      this.loadInboxEvents(hook.id);
    }
  }

  loadLogs(hookId: string) {
    this.isLogsLoading.set(true);
    this.logsError.set(null);
    this.webhookLogs.set([]);
    this.logsTotal.set(0);

    const selectedStatus = this.logsStatus();
    const status: 'delivered' | 'failed' | 'pending' | undefined =
      selectedStatus === 'all' ? undefined : selectedStatus;
    const params: { limit: number; status?: 'delivered' | 'failed' | 'pending' } = {
      limit: 50,
    };
    if (status) {
      params.status = status;
    }

    this.webhookService.listLogs(hookId, params).subscribe({
      next: (response) => {
        this.webhookLogs.set(response.logs);
        this.logsTotal.set(response.total);
        this.isLogsLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load webhook logs', err);
        this.logsError.set('Falha ao carregar o histórico de envios.');
        this.isLogsLoading.set(false);
      },
    });
  }

  setLogsStatus(status: 'all' | 'delivered' | 'failed' | 'pending') {
    this.logsStatus.set(status);
    const hook = this.hookForLogs();
    if (hook) {
      this.loadLogs(hook.id);
    }
  }

  copyId(value?: string) {
    if (!value) return;
    void navigator.clipboard?.writeText(value);
  }

  shortId(value?: string): string {
    if (!value) return '-';
    return value.length > 12 ? `${value.slice(0, 8)}...` : value;
  }

  isInboxWebhook(hook?: WebhookConfig | null): boolean {
    return Boolean(hook?.url.includes('/api/v1/dev/webhook-inbox/'));
  }

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
    const labels: Record<WebhookDeliveryStatus, string> = {
      PENDING: 'Pendente',
      DELIVERED: 'Entregue',
      FAILED_RETRYABLE: 'Falha temporária',
      FAILED_FINAL: 'Falha final',
    };

    return labels[this.resolveLogStatus(log)];
  }

  getLogStatusClasses(log: WebhookLog): string {
    const classes: Record<WebhookDeliveryStatus, string> = {
      PENDING:
        'w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center border border-zinc-200 text-zinc-500 shrink-0',
      DELIVERED:
        'w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 text-emerald-600 shrink-0',
      FAILED_RETRYABLE:
        'w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100 text-amber-600 shrink-0',
      FAILED_FINAL:
        'w-8 h-8 rounded-full bg-red-50 flex items-center justify-center border border-red-100 text-red-600 shrink-0',
    };

    return classes[this.resolveLogStatus(log)];
  }

  getLogStatusIcon(log: WebhookLog): string {
    const icons: Record<WebhookDeliveryStatus, string> = {
      PENDING: 'lucideClock',
      DELIVERED: 'lucideCheck',
      FAILED_RETRYABLE: 'lucideAlertTriangle',
      FAILED_FINAL: 'lucideXCircle',
    };

    return icons[this.resolveLogStatus(log)];
  }

  getLogStatusDetail(log: WebhookLog): string {
    const status = this.resolveLogStatus(log);
    const responseDetail =
      log.responseStatus !== undefined ? `HTTP ${log.responseStatus}` : 'sem resposta HTTP';

    if (status === 'PENDING') {
      return 'Aguardando processamento';
    }

    if (status === 'DELIVERED') {
      return log.responseStatus !== undefined ? `${responseDetail} entregue` : 'Entrega confirmada';
    }

    if (log.lastError) {
      return log.lastError;
    }

    return status === 'FAILED_RETRYABLE'
      ? `${responseDetail}; nova tentativa disponível`
      : `${responseDetail}; reprocessamento manual disponível`;
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
        // Refresh logs list after a successful retry request
        this.loadLogs(log.configId);
      },
      error: (err) => {
        this.isRetrying.update((state) => ({ ...state, [log.id]: false }));
        console.error('Failed to retry log', err);
        toast.error('Falha ao reprocessar esse evento.');
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

  loadWebhooks() {
    this.isLoading.set(true);
    this.error.set(null);
    this.webhooks.set([]);

    this.webhookService.list().subscribe({
      next: (response) => {
        this.webhooks.set(response.webhooks);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load webhooks', err);
        this.error.set('Houve um erro ao se comunicar com o servidor. Tente novamente mais tarde.');
        this.isLoading.set(false);
      },
    });
  }
}
