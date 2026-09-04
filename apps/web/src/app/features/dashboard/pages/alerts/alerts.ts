import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBellRing,
  lucideDisc3,
  lucideHistory,
  lucideMail,
  lucideMessageCircleMore,
  lucidePencil,
  lucidePlus,
  lucideRefreshCcw,
  lucideSend,
  lucideTrash2,
} from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';
import {
  AlertChannel,
  AlertConfig,
  AlertDeliveryLog,
  AlertService,
} from '../../../../core/services/alert.service';
import { PageHeader, PageState, Sheet, StatusChip } from '../../../../shared/ui';

type AlertChannelPreview = AlertChannel | 'email' | 'whatsapp';

interface AlertEventOption {
  id: string;
  label: string;
  description: string;
}

interface AlertFormValue {
  name: string;
  channel: AlertChannelPreview;
  webhookUrl: string;
  events: string[];
  isActive: boolean;
}

interface AlertChannelOption {
  id: AlertChannelPreview;
  label: string;
  summary: string;
  availability: string;
  enabled: boolean;
  icon: string;
}

const EVENT_OPTIONS: AlertEventOption[] = [
  {
    id: 'payment.created',
    label: 'Pagamento criado',
    description: 'Avisa quando uma nova cobrança entra no fluxo da loja.',
  },
  {
    id: 'payment.confirmed',
    label: 'Pagamento confirmado',
    description: 'Ideal para sinalizar vendas concluídas e acompanhamento operacional.',
  },
  {
    id: 'payment.failed',
    label: 'Pagamento falhou',
    description: 'Destaca falhas de pagamento que podem exigir ação rápida do time.',
  },
  {
    id: 'payment.expired',
    label: 'Pagamento expirado',
    description: 'Ajuda a monitorar abandono ou perda de conversão no checkout.',
  },
  {
    id: 'payment.released',
    label: 'Repasse liberado',
    description: 'Útil para acompanhamento financeiro e conciliação da operação.',
  },
  {
    id: 'payment.refunded',
    label: 'Pagamento estornado',
    description: 'Sinaliza estornos, que mexem no saldo e costumam exigir conferência.',
  },
  {
    id: 'payment_link.created',
    label: 'Link criado',
    description: 'Avisa quando alguém do time cria um link, inclusive pelo dashboard.',
  },
  {
    id: 'payment_link.paid',
    label: 'Link pago',
    description: 'Fecha o ciclo do link sem precisar cruzar o pagamento com o link na mão.',
  },
  {
    id: 'payment_link.expired',
    label: 'Link expirado',
    description: 'Mostra links que morreram sem conversão.',
  },
  {
    id: 'payment_link.cancelled',
    label: 'Link cancelado',
    description: 'Registra quando alguém do time derruba um link antes do pagamento.',
  },
  {
    id: 'withdrawal.created',
    label: 'Saque solicitado',
    description: 'Acompanha saídas de saldo desde a solicitação.',
  },
  {
    id: 'withdrawal.processing',
    label: 'Saque em processamento',
    description: 'Indica que o saque saiu da fila e está sendo processado.',
  },
  {
    id: 'withdrawal.completed',
    label: 'Saque concluído',
    description: 'Confirma que o valor deixou o saldo da loja.',
  },
  {
    id: 'withdrawal.failed',
    label: 'Saque falhou',
    description: 'Destaca falhas de saque, com o valor devolvido ao saldo disponível.',
  },
];

const CHANNEL_OPTIONS: AlertChannelOption[] = [
  {
    id: 'discord',
    label: 'Discord',
    summary: 'Envio operacional em tempo real via webhook.',
    availability: 'Disponível agora',
    enabled: true,
    icon: 'lucideDisc3',
  },
  {
    id: 'email',
    label: 'Email',
    summary: 'Prévia desabilitada; envio por e-mail ainda não está disponível.',
    availability: 'Indisponível',
    enabled: false,
    icon: 'lucideMail',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    summary: 'Prévia desabilitada; envio por WhatsApp ainda não está disponível.',
    availability: 'Indisponível',
    enabled: false,
    icon: 'lucideMessageCircleMore',
  },
];

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [
    DatePipe,
    NgIcon,
    ReactiveFormsModule,
    PageHeader,
    PageState,
    Sheet,
    StatusChip,
  ],
  providers: [
    provideIcons({
      lucideBellRing,
      lucideDisc3,
      lucideHistory,
      lucideMail,
      lucideMessageCircleMore,
      lucidePencil,
      lucidePlus,
      lucideRefreshCcw,
      lucideSend,
      lucideTrash2,
    }),
  ],
  templateUrl: './alerts.html',
  styleUrl: './alerts.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Alerts implements OnInit {
  private readonly alertService = inject(AlertService);

  readonly availableChannels = CHANNEL_OPTIONS;
  readonly eventOptions = EVENT_OPTIONS;
  readonly alerts = signal<AlertConfig[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly isSubmitting = signal(false);
  readonly deletingAlertId = signal<string | null>(null);
  readonly testingAlertId = signal<string | null>(null);
  readonly retryingLogId = signal<string | null>(null);

  readonly sheetState = signal<'open' | 'closed'>('closed');
  readonly logsSheetState = signal<'open' | 'closed'>('closed');
  readonly deleteDialogState = signal<'open' | 'closed'>('closed');
  readonly editingAlertId = signal<string | null>(null);
  readonly alertToDelete = signal<AlertConfig | null>(null);
  readonly alertForLogs = signal<AlertConfig | null>(null);
  readonly logs = signal<AlertDeliveryLog[]>([]);
  readonly logsTotal = signal(0);
  readonly isLogsLoading = signal(false);
  readonly logsError = signal<string | null>(null);

  readonly alertForm = new FormGroup({
    name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    channel: new FormControl<AlertChannelPreview>('discord', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    webhookUrl: new FormControl<string>('', {
      nonNullable: true,
      validators: [discordWebhookUrlValidator],
    }),
    events: new FormControl<string[]>([], {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1)],
    }),
    isActive: new FormControl<boolean>(true, {
      nonNullable: true,
    }),
  });

  readonly activeAlertsCount = computed(() => this.alerts().filter((alert) => alert.isActive).length);
  readonly configuredChannelsCount = computed(() => new Set(this.alerts().map((alert) => alert.channel)).size);
  readonly isEditing = computed(() => this.editingAlertId() !== null);

  ngOnInit() {
    this.loadAlerts();
  }

  loadAlerts() {
    this.isLoading.set(true);
    this.error.set(null);

    this.alertService.list().subscribe({
      next: (response) => {
        this.alerts.set(response.alerts);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Não foi possível carregar os alertas.');
        this.isLoading.set(false);
      },
    });
  }

  openCreateSheet() {
    this.editingAlertId.set(null);
    this.resetForm();
    this.sheetState.set('open');
  }

  openEditSheet(alert: AlertConfig) {
    this.editingAlertId.set(alert.id);
    this.alertForm.setValue({
      name: alert.name,
      channel: alert.channel,
      webhookUrl: '',
      events: [...alert.events],
      isActive: alert.isActive,
    });
    this.alertForm.markAsPristine();
    this.alertForm.markAsUntouched();
    this.sheetState.set('open');
  }

  /* Escape, o X e o botão de cancelar chegam todos aqui. */
  closeSheet() {
    if (this.isSubmitting()) return;
    this.sheetState.set('closed');
    this.editingAlertId.set(null);
    this.resetForm();
  }

  closeLogsSheet() {
    this.logsSheetState.set('closed');
    this.alertForLogs.set(null);
    this.logs.set([]);
    this.logsError.set(null);
  }

  closeDeleteDialog() {
    if (this.deletingAlertId()) return;
    this.deleteDialogState.set('closed');
    this.alertToDelete.set(null);
  }

  selectChannel(channel: AlertChannelPreview) {
    const option = this.availableChannels.find((item) => item.id === channel);

    if (!option?.enabled) {
      return;
    }

    this.alertForm.controls.channel.setValue(channel);
    this.alertForm.controls.channel.markAsTouched();
  }

  isEventSelected(eventId: string) {
    return this.alertForm.controls.events.value.includes(eventId);
  }

  toggleEvent(eventId: string, checked: boolean) {
    const nextEvents = checked
      ? [...this.alertForm.controls.events.value, eventId]
      : this.alertForm.controls.events.value.filter((currentId) => currentId !== eventId);

    this.alertForm.controls.events.setValue([...new Set(nextEvents)]);
    this.alertForm.controls.events.markAsTouched();
    this.alertForm.controls.events.updateValueAndValidity();
  }

  saveAlert() {
    const editingId = this.editingAlertId();

    if (!editingId && !this.alertForm.controls.webhookUrl.value.trim()) {
      this.alertForm.controls.webhookUrl.setErrors({ required: true });
    }

    if (this.alertForm.invalid) {
      this.alertForm.markAllAsTouched();
      return;
    }

    const formValue = this.alertForm.getRawValue() as AlertFormValue;
    if (formValue.channel !== 'discord') {
      return;
    }

    this.isSubmitting.set(true);

    if (editingId) {
      const webhookUrl = formValue.webhookUrl.trim();
      this.alertService
        .update(editingId, {
          name: formValue.name,
          events: formValue.events,
          isActive: formValue.isActive,
          discord: webhookUrl ? { webhookUrl } : undefined,
        })
        .subscribe({
          next: (response) => {
            this.alerts.update((alerts) =>
              alerts.map((alert) => (alert.id === editingId ? response.alert : alert)),
            );
            this.afterSave('Alerta atualizado.');
          },
          error: () => this.onSaveError('Falha ao atualizar alerta.'),
        });
      return;
    }

    this.alertService
      .create({
        name: formValue.name,
        channel: 'discord',
        discord: { webhookUrl: formValue.webhookUrl.trim() },
        events: formValue.events,
        isActive: formValue.isActive,
      })
      .subscribe({
        next: (response) => {
          this.alerts.update((alerts) => [response.alert, ...alerts]);
          this.afterSave('Alerta criado.');
        },
        error: () => this.onSaveError('Falha ao criar alerta.'),
      });
  }

  toggleAlertStatus(id: string, isActive: boolean) {
    this.alertService.update(id, { isActive }).subscribe({
      next: (response) => {
        this.alerts.update((alerts) => alerts.map((alert) => (alert.id === id ? response.alert : alert)));
      },
      error: () => {
        toast.error('Falha ao alterar status do alerta.');
      },
    });
  }

  testAlert(alert: AlertConfig) {
    this.testingAlertId.set(alert.id);

    this.alertService.test(alert.id).subscribe({
      next: (response) => {
        this.testingAlertId.set(null);
        toast[response.success ? 'success' : 'error'](
          response.success ? 'Teste enviado para o Discord.' : 'O Discord retornou falha no teste.',
        );
      },
      error: () => {
        this.testingAlertId.set(null);
        toast.error('Falha ao testar alerta.');
      },
    });
  }

  openLogsSheet(alert: AlertConfig) {
    this.alertForLogs.set(alert);
    this.logsSheetState.set('open');
    this.loadLogs(alert.id);
  }

  loadLogs(alertId: string) {
    this.isLogsLoading.set(true);
    this.logsError.set(null);
    this.logs.set([]);

    this.alertService.listLogs(alertId, { limit: 50 }).subscribe({
      next: (response) => {
        this.logs.set(response.logs);
        this.logsTotal.set(response.total);
        this.isLogsLoading.set(false);
      },
      error: () => {
        this.logsError.set('Não foi possível carregar o histórico.');
        this.isLogsLoading.set(false);
      },
    });
  }

  retryLog(log: AlertDeliveryLog) {
    const alert = this.alertForLogs();
    if (!alert) return;

    this.retryingLogId.set(log.id);
    this.alertService.retryLog(alert.id, log.id).subscribe({
      next: () => {
        this.retryingLogId.set(null);
        toast.success('Reenvio solicitado.');
        this.loadLogs(alert.id);
      },
      error: () => {
        this.retryingLogId.set(null);
        toast.error('Falha ao reenviar alerta.');
      },
    });
  }

  openDeleteDialog(alert: AlertConfig) {
    this.alertToDelete.set(alert);
    this.deleteDialogState.set('open');
  }

  confirmDelete() {
    const target = this.alertToDelete();

    if (!target) {
      return;
    }

    this.deletingAlertId.set(target.id);
    this.alertService.delete(target.id).subscribe({
      next: () => {
        this.alerts.update((alerts) => alerts.filter((alert) => alert.id !== target.id));
        this.deletingAlertId.set(null);
        this.deleteDialogState.set('closed');
        this.alertToDelete.set(null);
        toast.success('Alerta removido.');
      },
      error: () => {
        this.deletingAlertId.set(null);
        toast.error('Falha ao remover alerta.');
      },
    });
  }

  channelLabel(channel: AlertChannelPreview) {
    return this.availableChannels.find((item) => item.id === channel)?.label ?? channel;
  }

  eventLabel(eventId: string) {
    return this.eventOptions.find((event) => event.id === eventId)?.label ?? eventId;
  }

  statusLabel(status: string) {
    const labels: Record<string, string> = {
      PENDING: 'Pendente',
      DELIVERED: 'Entregue',
      FAILED: 'Falhou',
    };
    return labels[status] ?? status;
  }

  canRetry(log: AlertDeliveryLog) {
    return log.status === 'FAILED';
  }

  private afterSave(message: string) {
    this.isSubmitting.set(false);
    this.sheetState.set('closed');
    this.editingAlertId.set(null);
    this.resetForm();
    toast.success(message);
  }

  private onSaveError(message: string) {
    this.isSubmitting.set(false);
    toast.error(message);
  }

  private resetForm() {
    this.alertForm.reset({
      name: '',
      channel: 'discord',
      webhookUrl: '',
      events: [],
      isActive: true,
    });
    this.alertForm.markAsPristine();
    this.alertForm.markAsUntouched();
  }
}

function discordWebhookUrlValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    const allowedHosts = ['discord.com', 'www.discord.com', 'discordapp.com', 'www.discordapp.com'];
    const parts = url.pathname.split('/').filter(Boolean);
    const isDiscordWebhook =
      url.protocol === 'https:' &&
      allowedHosts.includes(url.hostname) &&
      parts.length >= 4 &&
      parts[0] === 'api' &&
      parts[1] === 'webhooks';

    return isDiscordWebhook ? null : { discordWebhookUrl: true };
  } catch {
    return { discordWebhookUrl: true };
  }
}
