import { Component, computed, inject, signal } from '@angular/core';

import { type ApiKey, apiKeysResource, integrationCommands } from '../../data/integration';
import { MerchantSession } from '../../data/session';
import { toApiFailure } from '../../domain/api-error';
import {
  MerButton,
  MerChip,
  MerCopy,
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
 * Chaves de API: quem pode falar com a API no lugar da loja.
 *
 * A tela inteira gira em torno de um fato do backend: **a chave em claro existe
 * uma vez só**. Ela aparece na resposta da criação e nunca mais — nem a API
 * guarda cópia legível. Por isso o sucesso não é um aviso que some em quatro
 * segundos: é um painel que fica na tela, com o botão de copiar, até o lojista
 * dizer que já guardou.
 *
 * Revogar é destrutivo e imediato, então passa por uma pergunta. A chave
 * revogada continua na lista, apagada: some da vista quem só quer as ativas, e
 * fica para quem está investigando qual chave quebrou uma integração ontem.
 */
@Component({
  selector: 'app-console-api',
  standalone: true,
  imports: [
    MerButton,
    MerChip,
    MerCopy,
    MerField,
    MerNotice,
    MerPageHeader,
    MerPageState,
    MerPanel,
    MerSheet,
    MerTable,
  ],
  templateUrl: './api.html',
  styleUrl: './api.css',
})
export class ConsoleApi {
  private readonly commands = integrationCommands();
  private readonly toast = inject(MerToastService);

  protected readonly session = inject(MerchantSession);
  protected readonly keys = apiKeysResource();

  protected readonly all = computed(() => this.keys.value().apiKeys);
  protected readonly active = computed(() => this.all().filter((key) => !key.revokedAt));
  protected readonly revoked = computed(() => this.all().filter((key) => key.revokedAt));

  protected readonly showRevoked = signal(false);
  protected readonly shown = computed(() => (this.showRevoked() ? this.all() : this.active()));

  protected readonly failure = computed(() => {
    const error = this.keys.error();
    return error ? toApiFailure(error) : null;
  });

  protected readonly isEmpty = computed(() => !this.keys.isLoading() && this.all().length === 0);

  /* ── Nova chave ─────────────────────────────────────────────────────── */
  protected readonly sheetOpen = signal(false);
  protected readonly name = signal('');
  protected readonly environment = signal('TEST');
  protected readonly creating = signal(false);
  protected readonly formError = signal('');

  /** A chave em claro, que só existe enquanto esta tela estiver aberta. */
  protected readonly plainKey = signal('');
  protected readonly plainKeyName = signal('');

  /* ── Revogação ──────────────────────────────────────────────────────── */
  protected readonly revoking = signal<ApiKey | null>(null);
  protected readonly busy = signal(false);

  protected openSheet(): void {
    this.name.set('');
    this.environment.set(this.session.environment());
    this.formError.set('');
    this.sheetOpen.set(true);
  }

  protected closeSheet(): void {
    if (this.creating()) return;
    this.sheetOpen.set(false);
  }

  protected async create(): Promise<void> {
    const name = this.name().trim();

    if (!name) {
      this.formError.set('Dê um nome para reconhecer esta chave depois.');
      return;
    }

    this.creating.set(true);
    const result = await this.commands.createKey({ name, environment: this.environment() });
    this.creating.set(false);

    if (!result.ok) {
      this.formError.set(result.failure.message);
      return;
    }

    this.plainKey.set(result.value.plainKey);
    this.plainKeyName.set(name);
    this.sheetOpen.set(false);
    this.toast.ok('Chave criada.', 'Copie agora: ela não aparece de novo.');
    this.keys.reload();
  }

  /** O lojista diz que guardou. Só aí a chave sai da tela. */
  protected dismissKey(): void {
    this.plainKey.set('');
    this.plainKeyName.set('');
  }

  protected async revoke(): Promise<void> {
    const key = this.revoking();
    if (!key || this.busy()) return;

    this.busy.set(true);
    const result = await this.commands.revokeKey(key.id);
    this.busy.set(false);

    if (!result.ok) {
      this.toast.bad('Não foi possível revogar a chave.', result.failure.message);
      return;
    }

    this.revoking.set(null);
    this.toast.ok(`Chave "${key.name}" revogada.`, 'Qualquer requisição com ela passa a falhar.');
    this.keys.reload();
  }

  protected environmentTone(environment: string): 'warn' | 'neutral' {
    // LIVE é o ambiente que move saldo de verdade: ele se destaca, TEST não.
    return environment === 'LIVE' ? 'warn' : 'neutral';
  }

  protected when(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }
}
