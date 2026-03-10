import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { WebhookService, WebhookConfig, WebhookLog } from '../../../../core/services/webhook.service';
import { DialogImports } from '../../../../shared/components/dialog/dialog.component';

// Spartan UI
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';

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
  lucidePencil,
  lucideCopy,
  lucideAlertTriangle,
  lucideCheck
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
    ...DialogImports
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
      lucidePencil,
      // added missing from imports
      lucideCopy,
      lucideAlertTriangle,
      lucideCheck
    })
  ],
  templateUrl: './webhooks.html'
})
export class Webhooks implements OnInit {
  private readonly webhookService = inject(WebhookService);

  // State Signals
  webhooks = signal<WebhookConfig[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  // Creation State
  isCreating = signal<boolean>(false);
  newWebhookForm = new FormGroup({
    url: new FormControl('', [Validators.required, Validators.pattern('https?://.+')]),
    events: new FormControl<string[]>([], [Validators.required, Validators.minLength(1)])
  });

  availableEvents = [
    { id: 'payment.created', label: 'Pagamento Criado' },
    { id: 'payment.confirmed', label: 'Pagamento Confirmado' },
    { id: 'payment.failed', label: 'Pagamento Falhou' },
    { id: 'payment.expired', label: 'Pagamento Expirado' },
    { id: 'payment.released', label: 'Repasse Liberado' },
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
  isLogsLoading = signal<boolean>(false);
  logsError = signal<string | null>(null);
  isRetrying = signal<{ [logId: string]: boolean }>({});

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
      eventsControl?.setValue(currentEvents.filter(e => e !== eventId));
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
        this.webhooks.update(hooks => [createdConfig, ...hooks]);

        this.newSecret.set(response.secret);
        this.copied.set(false);

        // Transition from Create to Secret Modal
        this.createDialogState.set('closed');
        this.secretDialogState.set('open');
      },
      error: (err) => {
        this.isCreating.set(false);
        console.error('Failed to create webhook', err);
        alert('Falha ao criar Webhook. Verifique os dados e tente novamente.');
      }
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
        // but we can alert the user.
        alert('Falha ao disparar o ping de teste. O endpoint pode estar inacessível.');
      }
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
        alert('Falha ao excluir webhook.');
      }
    });
  }

  // --- LOGS (Delivery History) ---
  openLogsDialog(hook: WebhookConfig) {
    this.hookForLogs.set(hook);
    this.logsDialogState.set('open');
    this.loadLogs(hook.id);
  }

  closeLogsDialog() {
    this.logsDialogState.set('closed');
    setTimeout(() => {
      this.hookForLogs.set(null);
      this.webhookLogs.set([]);
    }, 200);
  }

  loadLogs(hookId: string) {
    this.isLogsLoading.set(true);
    this.logsError.set(null);
    this.webhookLogs.set([]);

    // Query 50 most recent logs roughly
    this.webhookService.listLogs(hookId, { limit: 50 }).subscribe({
      next: (response) => {
        this.webhookLogs.set(response.logs);
        this.isLogsLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load webhook logs', err);
        this.logsError.set('Falha ao carregar o histórico de envios.');
        this.isLogsLoading.set(false);
      }
    });
  }

  retryLog(log: WebhookLog) {
    this.isRetrying.update(state => ({ ...state, [log.id]: true }));

    this.webhookService.retryLog(log.configId, log.id).subscribe({
      next: () => {
        this.isRetrying.update(state => ({ ...state, [log.id]: false }));
        // Refresh logs list after a successful retry request
        this.loadLogs(log.configId);
      },
      error: (err) => {
        this.isRetrying.update(state => ({ ...state, [log.id]: false }));
        console.error('Failed to retry log', err);
        alert('Falha ao reprocessar esse evento.');
      }
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
      error: (err) => {
        console.error('Failed to load webhooks', err);
        this.error.set('Houve um erro ao se comunicar com o servidor. Tente novamente mais tarde.');
        this.isLoading.set(false);
      }
    });
  }
}
