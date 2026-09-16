import { Component, computed, inject, linkedSignal, signal } from '@angular/core';

import { MerchantSession } from '../../data/session';
import { storeSettingsCommands } from '../../data/store-settings';
import {
  canRequestLive,
  feeLine,
  liveLabel,
  liveNote,
  liveTone,
  settlementLine,
} from '../../domain/live-status';
import {
  MerButton,
  MerChip,
  MerCopy,
  MerField,
  MerNotice,
  MerPageHeader,
  MerPanel,
  MerStat,
  MerToastService,
} from '../../ui';

/**
 * Configurações: a conta, a loja e o que a HockPay cobra dela.
 *
 * É a única tela do console onde o lojista encontra **a mesa do outro lado**.
 * Cobrar em TEST não depende de aprovação nenhuma; LIVE passa por uma decisão
 * humana, e cada estado dessa decisão leva a frase que responde "e agora?" —
 * que vive em `domain/live-status`, com teste, porque é texto que muda o que a
 * pessoa faz a seguir.
 *
 * As condições comerciais são **leitura**. Quem as edita é a mesa, e um campo
 * editável aqui prometeria um poder que o lojista não tem.
 */
@Component({
  selector: 'app-console-settings',
  standalone: true,
  imports: [MerButton, MerChip, MerCopy, MerField, MerNotice, MerPageHeader, MerPanel, MerStat],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class ConsoleSettings {
  private readonly commands = storeSettingsCommands();
  private readonly toast = inject(MerToastService);

  protected readonly session = inject(MerchantSession);

  protected readonly store = computed(() => this.session.store());
  protected readonly user = computed(() => this.session.user());

  protected readonly liveStatus = computed(() => this.store()?.liveStatus ?? 'NOT_REQUESTED');
  protected readonly statusLabel = computed(() => liveLabel(this.liveStatus()));
  protected readonly statusNote = computed(() => liveNote(this.liveStatus()));
  protected readonly statusTone = computed(() => liveTone(this.liveStatus()));
  protected readonly canAskLive = computed(() => canRequestLive(this.liveStatus()));

  protected readonly fee = computed(() => {
    const store = this.store();
    return store ? feeLine(store.feePercent, store.feeFixed) : '—';
  });

  protected readonly settlement = computed(() => {
    const store = this.store();
    return store ? settlementLine(store.settlementDays) : '—';
  });

  /* ── Perfil da loja ─────────────────────────────────────────────────── */

  /**
   * Os campos seguem a loja, até alguém digitar.
   *
   * Sinal solto não serve: a loja chega **depois** da tela, porque
   * `loadStores()` é uma requisição, e um `set` no construtor grava o vazio de
   * antes da resposta — foi o que a captura desta fatia flagrou, com o campo
   * Nome em branco ao lado de uma loja chamada Café Figo. `linkedSignal`
   * recalcula quando a loja **muda de identidade** (chegou, ou o lojista trocou
   * de loja no trilho) e preserva o que está sendo digitado enquanto ela é a
   * mesma.
   */
  protected readonly name = linkedSignal<string, string>({
    source: () => this.store()?.id ?? '',
    computation: (storeId, previous) =>
      previous && storeId === previous.source ? previous.value : (this.store()?.name ?? ''),
  });

  protected readonly city = linkedSignal<string, string>({
    source: () => this.store()?.id ?? '',
    computation: (storeId, previous) =>
      previous && storeId === previous.source ? previous.value : (this.store()?.city ?? ''),
  });

  protected readonly saving = signal(false);
  protected readonly asking = signal(false);
  protected readonly formError = signal('');

  /** O que está digitado difere do que está gravado. */
  protected readonly dirty = computed(() => {
    const store = this.store();
    if (!store) return false;
    return this.name().trim() !== store.name || this.city().trim() !== (store.city ?? '');
  });

  constructor() {
    this.session.loadStores();
  }

  /** Descarta o que foi digitado e volta ao que está gravado hoje. */
  protected fill(): void {
    const store = this.store();
    this.name.set(store?.name ?? '');
    this.city.set(store?.city ?? '');
    this.formError.set('');
  }

  protected async save(): Promise<void> {
    const store = this.store();
    if (!store || this.saving()) return;

    const name = this.name().trim();
    if (!name) {
      this.formError.set('A loja precisa de um nome.');
      return;
    }

    this.saving.set(true);
    const result = await this.commands.updateProfile(store.id, {
      name,
      city: this.city().trim() || undefined,
    });
    this.saving.set(false);

    if (!result.ok) {
      this.formError.set(result.failure.message);
      return;
    }

    this.formError.set('');
    this.toast.ok('Loja atualizada.');
    await this.commands.reload();
  }

  protected async requestLive(): Promise<void> {
    const store = this.store();
    if (!store || !this.canAskLive() || this.asking()) return;

    this.asking.set(true);
    const result = await this.commands.requestLive(store.id);
    this.asking.set(false);

    if (!result.ok) {
      this.toast.bad('Não foi possível pedir a habilitação.', result.failure.message);
      return;
    }

    this.toast.ok(
      'Pedido enviado para a mesa.',
      'TEST continua funcionando normalmente enquanto isso.',
    );
    await this.commands.reload();
  }

  protected when(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  protected maskDocument(value?: string | null): string {
    const clean = String(value ?? '').replace(/\D/g, '');
    if (clean.length === 11) {
      return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
    }
    if (clean.length === 14) {
      return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`;
    }
    return value || '—';
  }
}
