import { Component, computed, inject, linkedSignal, signal } from '@angular/core';

import {
  type Alert,
  type AlertLog,
  alertLogsResource,
  alertsResource,
  integrationCommands,
} from '../../data/integration';
import { CHANNEL_OPTIONS, alertBlocker, channelLabel } from '../../domain/alert-channels';
import { toApiFailure } from '../../domain/api-error';
import { eventLabel, eventSummary } from '../../domain/webhook-events';
import {
  MerButton,
  MerChip,
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

/**
 * Alertas: o aviso que vai para uma pessoa, não para um servidor.
 *
 * É a irmã da tela de webhooks, e a diferença cabe numa frase: webhook é
 * integração — a sua aplicação reage sozinha; alerta é operação — alguém lê no
 * celular. Por isso os dois assinam a mesma lista de eventos (em
 * `packages/core`, `ALLOWED_ALERT_EVENTS` é cópia de `ALLOWED_WEBHOOK_EVENTS`)
 * e compartilham o mesmo seletor.
 *
 * Duas sutilezas do backend que a tela precisa respeitar:
 *
 * - **a URL não volta na leitura.** A API devolve só uma prévia mascarada. Na
 *   edição, campo vazio significa "mantenha a que está gravada" — e a tela diz
 *   isso em vez de deixar o lojista achar que apagou.
 * - **os canais que ainda não existem aparecem desligados.** Uma lista com uma
 *   opção só é lida como "este produto não faz isso".
 */
@Component({
  selector: 'app-console-alerts',
  standalone: true,
  imports: [
    MerButton,
    MerChip,
    MerEventPicker,
    MerField,
    MerNotice,
    MerPageHeader,
    MerPageState,
    MerPanel,
    MerSheet,
    MerTable,
  ],
  templateUrl: './alerts.html',
  styleUrl: './alerts.css',
})
export class ConsoleAlerts {
  private readonly commands = integrationCommands();
  private readonly toast = inject(MerToastService);

  protected readonly alerts = alertsResource();
  protected readonly channels = CHANNEL_OPTIONS;

  protected readonly list = computed(() => this.alerts.value().alerts);

  protected readonly selectedId = linkedSignal<readonly Alert[], string>({
    source: () => this.list(),
    computation: (list, previous) =>
      list.find((alert) => alert.id === previous?.value)?.id ?? list[0]?.id ?? '',
  });

  protected readonly selected = computed(
    () => this.list().find((alert) => alert.id === this.selectedId()) ?? null,
  );

  protected readonly logs = alertLogsResource(this.selectedId);

  protected readonly failure = computed(() => {
    const error = this.alerts.error();
    return error ? toApiFailure(error) : null;
  });

  protected readonly isEmpty = computed(() => !this.alerts.isLoading() && this.list().length === 0);

  /* ── Criar e editar: a mesma folha ──────────────────────────────────── */
  protected readonly sheetOpen = signal(false);
  protected readonly editing = signal<Alert | null>(null);
  protected readonly name = signal('');
  protected readonly channel = signal('discord');
  protected readonly webhookUrl = signal('');
  protected readonly events = signal<readonly string[]>([]);
  protected readonly isActive = signal(true);
  protected readonly saving = signal(false);
  protected readonly formError = signal('');

  protected readonly blocker = computed(() =>
    alertBlocker({
      name: this.name(),
      webhookUrl: this.webhookUrl(),
      events: this.events(),
      isEditing: !!this.editing(),
    }),
  );

  /* ── Ações ──────────────────────────────────────────────────────────── */
  protected readonly busy = signal('');
  protected readonly removing = signal<Alert | null>(null);

  protected openNew(): void {
    this.editing.set(null);
    this.name.set('');
    this.channel.set('discord');
    this.webhookUrl.set('');
    this.events.set([]);
    this.isActive.set(true);
    this.formError.set('');
    this.sheetOpen.set(true);
  }

  protected openEdit(alert: Alert): void {
    this.editing.set(alert);
    this.name.set(alert.name);
    this.channel.set(alert.channel);
    // Vazio de propósito: a API não devolve a URL gravada.
    this.webhookUrl.set('');
    this.events.set(alert.events);
    this.isActive.set(alert.isActive);
    this.formError.set('');
    this.sheetOpen.set(true);
  }

  protected closeSheet(): void {
    if (this.saving()) return;
    this.sheetOpen.set(false);
  }

  protected async save(): Promise<void> {
    const blocker = this.blocker();
    if (blocker) {
      this.formError.set(blocker);
      return;
    }

    const alert = this.editing();
    const url = this.webhookUrl().trim();

    this.saving.set(true);
    const result = alert
      ? await this.commands.updateAlert(alert.id, {
          name: this.name().trim(),
          events: this.events(),
          isActive: this.isActive(),
          // Só manda a URL quando ela foi digitada: sem isso, salvar o nome
          // apagaria o destino.
          ...(url ? { discord: { webhookUrl: url } } : {}),
        })
      : await this.commands.createAlert({
          name: this.name().trim(),
          channel: 'discord',
          discord: { webhookUrl: url },
          events: this.events(),
          isActive: this.isActive(),
        });
    this.saving.set(false);

    if (!result.ok) {
      this.formError.set(result.failure.message);
      return;
    }

    this.sheetOpen.set(false);
    this.toast.ok(alert ? 'Alerta atualizado.' : 'Alerta criado.');
    this.alerts.reload();
  }

  protected async test(alert: Alert): Promise<void> {
    if (this.busy()) return;

    this.busy.set(alert.id);
    const result = await this.commands.testAlert(alert.id);
    this.busy.set('');

    if (!result.ok) {
      this.toast.bad('O teste não saiu.', result.failure.message);
      return;
    }

    this.toast.ok('Teste enviado.', 'Confira o canal — e o histórico aqui embaixo.');
    this.logs.reload();
  }

  protected async toggle(alert: Alert): Promise<void> {
    if (this.busy()) return;

    this.busy.set(alert.id);
    const result = await this.commands.updateAlert(alert.id, { isActive: !alert.isActive });
    this.busy.set('');

    if (!result.ok) {
      this.toast.bad('Não foi possível mudar o alerta.', result.failure.message);
      return;
    }

    this.toast.info(alert.isActive ? 'Alerta pausado.' : 'Alerta reativado.');
    this.alerts.reload();
  }

  protected async remove(): Promise<void> {
    const alert = this.removing();
    if (!alert || this.busy()) return;

    this.busy.set(alert.id);
    const result = await this.commands.deleteAlert(alert.id);
    this.busy.set('');

    if (!result.ok) {
      this.toast.bad('Não foi possível excluir o alerta.', result.failure.message);
      return;
    }

    this.removing.set(null);
    this.toast.ok('Alerta excluído.');
    this.alerts.reload();
  }

  protected async retry(log: AlertLog): Promise<void> {
    const id = this.selectedId();
    if (!id || this.busy()) return;

    this.busy.set(log.id);
    const result = await this.commands.retryAlert(id, log.id);
    this.busy.set('');

    if (!result.ok) {
      this.toast.bad('Não foi possível reenviar.', result.failure.message);
      return;
    }

    this.toast.ok('Reenvio pedido.');
    this.logs.reload();
  }

  protected select(id: string): void {
    this.selectedId.set(id);
  }

  protected setEvents(events: readonly string[]): void {
    this.events.set(events);
    this.formError.set('');
  }

  protected reload(): void {
    this.alerts.reload();
    this.logs.reload();
  }

  /* ── Tradução ───────────────────────────────────────────────────────── */
  protected eventName = eventLabel;
  protected summaryOf = eventSummary;
  protected channelName = channelLabel;

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
