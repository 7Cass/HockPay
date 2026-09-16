import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { listQuery } from '../../data/list-query';
import {
  WITHDRAWAL_QUERY,
  type PixDestination,
  accountResource,
  destinationsResource,
  moneyCommands,
  withdrawalsResource,
} from '../../data/money';
import { MerchantSession } from '../../data/session';
import { parseReaisToCents } from '../../domain/api-contracts';
import { toApiFailure } from '../../domain/api-error';
import {
  WITHDRAWAL_FEE,
  withdrawalBlocker,
  withdrawalCeiling,
  withdrawalNet,
} from '../../domain/withdrawal-policy';
import {
  MerButton,
  MerChip,
  MerField,
  MerNotice,
  MerPageHeader,
  MerPageState,
  MerPagination,
  MerPanel,
  MerSheet,
  MerStat,
  MerTable,
} from '../../ui';

const STATUS = [
  { value: '', label: 'Todos os status' },
  { value: 'PENDING', label: 'Pendente' },
  { value: 'PROCESSING', label: 'Processando' },
  { value: 'COMPLETED', label: 'Concluído' },
  { value: 'FAILED', label: 'Falhou' },
];

/**
 * Saques: mandar saldo disponível para uma chave Pix do mesmo titular.
 *
 * O formulário tem **dois passos** de propósito. O primeiro escolhe destino e
 * valor; o segundo repete em prosa o que vai acontecer — quanto sai, de qual
 * saldo, com que taxa e quanto chega. Saque é a única ação desta tela que move
 * dinheiro, e a confirmação existe para que ninguém a execute de passagem.
 *
 * A validação vem de `domain/withdrawal-policy`, e é cópia consciente da regra
 * da API: a tela avisa antes; quem decide é o backend, e quando os dois
 * divergirem quem aparece na tela é a mensagem dele.
 */
@Component({
  selector: 'app-console-withdrawals',
  standalone: true,
  imports: [
    MerButton,
    MerChip,
    MerField,
    MerNotice,
    MerPageHeader,
    MerPageState,
    MerPagination,
    MerPanel,
    MerSheet,
    MerStat,
    MerTable,
  ],
  templateUrl: './withdrawals.html',
  styleUrl: './withdrawals.css',
})
export class ConsoleWithdrawals {
  private readonly router = inject(Router);
  private readonly commands = moneyCommands();

  protected readonly session = inject(MerchantSession);
  protected readonly query = listQuery(WITHDRAWAL_QUERY);
  protected readonly params = this.query.params;
  protected readonly statuses = STATUS;
  protected readonly fee = WITHDRAWAL_FEE;

  protected readonly account = accountResource();
  protected readonly destinations = destinationsResource();
  protected readonly withdrawals = withdrawalsResource(this.params);

  protected readonly balance = computed(() => this.account.value().account);
  protected readonly page = computed(() => this.withdrawals.value());
  protected readonly summary = computed(() => this.page().summary);
  protected readonly verified = computed(() =>
    this.destinations.value().filter((d) => d.isVerified),
  );

  protected readonly failure = computed(() => {
    const error = this.withdrawals.error() ?? this.account.error();
    return error ? toApiFailure(error) : null;
  });

  protected readonly isEmpty = computed(
    () => !this.withdrawals.isLoading() && this.page().withdrawals.length === 0,
  );

  /* ── A folha do saque ───────────────────────────────────────────────── */
  protected readonly sheetOpen = signal(false);
  protected readonly confirming = signal(false);
  protected readonly sending = signal(false);
  protected readonly destinationId = signal('');
  protected readonly amountText = signal('');
  protected readonly formError = signal('');
  protected readonly createdId = signal('');

  /** Centavos lidos pelo parser estrito: `10.50` é recusado, não vira milhar. */
  protected readonly amount = computed(() => parseReaisToCents(this.amountText()) ?? 0);
  protected readonly net = computed(() => withdrawalNet(this.amount()));

  protected readonly blocker = computed(() =>
    withdrawalBlocker({
      amount: this.amount(),
      available: this.balance().available,
      hasVerifiedAccount: !!this.verified().find((d) => d.id === this.destinationId()),
    }),
  );

  /* ── A folha dos destinos ───────────────────────────────────────────── */
  protected readonly destinationsOpen = signal(false);
  protected readonly destinationError = signal('');
  protected readonly busyDestination = signal('');

  protected openSheet(): void {
    this.formError.set('');
    this.createdId.set('');
    this.confirming.set(false);
    this.amountText.set('');
    this.destinationId.set(this.verified()[0]?.id ?? '');
    this.sheetOpen.set(true);
  }

  protected closeSheet(): void {
    if (this.sending()) return;
    this.sheetOpen.set(false);
    this.confirming.set(false);
    this.formError.set('');
  }

  protected setDestination(id: string): void {
    this.destinationId.set(id);
    this.formError.set('');
  }

  protected setAmount(value: string): void {
    this.amountText.set(value);
    this.formError.set('');
  }

  /** O maior saque possível agora: saldo, limitado pelo teto da política. */
  protected useMax(): void {
    const ceiling = withdrawalCeiling(this.balance().available);
    if (!ceiling) return;
    this.amountText.set((ceiling / 100).toFixed(2).replace('.', ','));
    this.formError.set('');
  }

  protected advance(): void {
    const blocker = this.blocker();
    if (blocker) {
      this.formError.set(blocker);
      return;
    }
    this.confirming.set(true);
  }

  protected back(): void {
    this.confirming.set(false);
  }

  protected async send(): Promise<void> {
    if (this.sending()) return;

    const blocker = this.blocker();
    if (blocker) {
      this.formError.set(blocker);
      this.confirming.set(false);
      return;
    }

    const intent = { bankAccountId: this.destinationId(), amount: this.amount() };
    this.sending.set(true);
    const result = await this.commands.createWithdrawal(intent);
    this.sending.set(false);

    if (!result.ok) {
      // A mensagem da API ganha da nossa: quando as duas divergem, quem decide
      // é quem recusou.
      this.formError.set(result.failure.message);
      this.confirming.set(false);
      return;
    }

    // Sucesso fecha a intenção: o próximo saque igual é um saque novo.
    this.commands.forgetWithdrawal(intent);
    this.createdId.set(result.value.withdrawal.id);
    this.sheetOpen.set(false);
    this.confirming.set(false);
    this.amountText.set('');
    this.reload();
  }

  protected openCreated(): void {
    const id = this.createdId();
    if (id) void this.router.navigate(['/dashboard/withdrawals', id]);
  }

  /* ── Destinos ───────────────────────────────────────────────────────── */
  protected async createDestination(): Promise<void> {
    const holderDocument = this.session.document();
    const holderName = this.session.name().trim();

    if (!holderDocument || !holderName) {
      this.destinationError.set('Não achei nome e documento da conta autenticada.');
      return;
    }

    this.busyDestination.set('new');
    const result = await this.commands.createDestination({
      pixKey: holderDocument,
      pixKeyType: this.session.documentType(),
      holderName,
      holderDocument,
      isDefault: this.destinations.value().length === 0,
    });
    this.busyDestination.set('');

    if (!result.ok) {
      this.destinationError.set(result.failure.message);
      return;
    }

    this.destinationError.set('');
    this.destinations.reload();
  }

  protected async makeDefault(destination: PixDestination): Promise<void> {
    if (destination.isDefault || this.busyDestination()) return;

    this.busyDestination.set(destination.id);
    const result = await this.commands.setDefaultDestination(destination.id);
    this.busyDestination.set('');

    if (!result.ok) {
      this.destinationError.set(result.failure.message);
      return;
    }
    this.destinations.reload();
  }

  protected async remove(destination: PixDestination): Promise<void> {
    if (this.busyDestination()) return;

    if (destination.hasWithdrawals) {
      this.destinationError.set('Esta conta tem saques vinculados e não pode ser removida.');
      return;
    }

    this.busyDestination.set(destination.id);
    const result = await this.commands.removeDestination(destination.id);
    this.busyDestination.set('');

    if (!result.ok) {
      this.destinationError.set(result.failure.message);
      return;
    }
    this.destinations.reload();
  }

  /* ── Lista ──────────────────────────────────────────────────────────── */
  protected setStatus(value: string): void {
    this.query.set({ status: value });
  }

  protected setAccount(value: string): void {
    this.query.set({ account: value });
  }

  protected search(value: string): void {
    this.query.set({ q: value.trim() });
  }

  protected setStart(value: string): void {
    this.query.set({ startDate: value });
  }

  protected setEnd(value: string): void {
    this.query.set({ endDate: value });
  }

  protected clear(): void {
    this.query.clear();
  }

  protected goTo(page: number): void {
    this.query.page(page);
  }

  protected reload(): void {
    this.account.reload();
    this.withdrawals.reload();
    this.destinations.reload();
  }

  protected open(id: string): void {
    void this.router.navigate(['/dashboard/withdrawals', id]);
  }

  protected destinationLabel(id: string): string {
    const destination = this.destinations.value().find((item) => item.id === id);
    if (!destination) return this.short(id);
    return `${destination.pixKeyType} ${this.maskDocument(destination.pixKey)}`;
  }

  protected short(value?: string | null): string {
    if (!value) return '—';
    return value.length <= 12 ? value : `${value.slice(0, 8)}…`;
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

  protected money(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
