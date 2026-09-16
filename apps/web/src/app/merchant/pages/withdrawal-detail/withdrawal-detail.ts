import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { accountResource, moneyCommands, withdrawalResource } from '../../data/money';
import { MerchantSession } from '../../data/session';
import { toApiFailure } from '../../domain/api-error';
import type { Tone } from '../../domain/tone';
import {
  MerButton,
  MerChip,
  MerNotice,
  MerPageHeader,
  MerPageState,
  MerPanel,
  MerSheet,
} from '../../ui';

/** O fio do tempo ganha cor pelo que o evento significa, não pelo nome dele. */
const TIMELINE_TONES: Readonly<Record<string, Tone>> = {
  SENT: 'ok',
  FAILED: 'bad',
  PROCESSING: 'warn',
  RETRY_SCHEDULED: 'warn',
};

const LEDGER_LABELS: Readonly<Record<string, string>> = {
  WITHDRAWAL_RESERVED: 'Saldo reservado',
  WITHDRAWAL_SENT: 'Saque enviado',
  WITHDRAWAL_REVERSED: 'Saldo devolvido',
};

/**
 * O detalhe de um saque: para onde foi, quanto custou e o que o processamento
 * fez até agora.
 *
 * As duas ações de simulação são TEST e dizem isso na confirmação. Elas existem
 * porque o worker leva o saque ao desfecho sozinho, e quem está estudando o
 * fluxo não deveria ter que esperar o cron para ver o saldo voltar.
 */
@Component({
  selector: 'app-console-withdrawal-detail',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    MerButton,
    MerChip,
    MerNotice,
    MerPageHeader,
    MerPageState,
    MerPanel,
    MerSheet,
  ],
  templateUrl: './withdrawal-detail.html',
  styleUrl: './withdrawal-detail.css',
})
export class ConsoleWithdrawalDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly commands = moneyCommands();

  protected readonly session = inject(MerchantSession);

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('id') ?? '' },
  );

  protected readonly detail = withdrawalResource(this.id);
  protected readonly account = accountResource();

  protected readonly withdrawal = computed(() => this.detail.value()?.withdrawal ?? null);
  protected readonly destination = computed(() => this.detail.value()?.bankAccount ?? null);
  protected readonly timeline = computed(() => this.detail.value()?.timeline ?? []);
  protected readonly entries = computed(() => this.detail.value()?.transactions ?? []);
  protected readonly balance = computed(() => this.account.value().account);

  protected readonly failure = computed(() =>
    this.detail.error() ? toApiFailure(this.detail.error()) : null,
  );

  /** Só saque em voo pode ser levado ao desfecho pela tela. */
  protected readonly canSimulate = computed(() => {
    const status = this.withdrawal()?.status;
    return status === 'PENDING' || status === 'PROCESSING';
  });

  protected readonly pending = signal<'complete' | 'fail' | null>(null);
  protected readonly running = signal(false);
  protected readonly actionError = signal('');

  protected ask(action: 'complete' | 'fail'): void {
    if (!this.canSimulate()) return;
    this.actionError.set('');
    this.pending.set(action);
  }

  protected close(): void {
    if (this.running()) return;
    this.pending.set(null);
  }

  protected async confirm(): Promise<void> {
    const action = this.pending();
    const id = this.withdrawal()?.id;
    if (!action || !id || this.running()) return;

    this.running.set(true);
    const result =
      action === 'complete'
        ? await this.commands.completeWithdrawal(id)
        : await this.commands.failWithdrawal(id);
    this.running.set(false);

    if (!result.ok) {
      this.actionError.set(result.failure.message);
      return;
    }

    this.pending.set(null);
    this.detail.reload();
    this.account.reload();
  }

  protected readonly confirmTitle = computed(() =>
    this.pending() === 'complete' ? 'Completar este saque' : 'Falhar este saque',
  );

  protected readonly confirmNote = computed(() =>
    this.pending() === 'complete'
      ? 'O saque passa a constar como concluído. Nenhum dinheiro se move — é simulação.'
      : 'O saque passa a constar como falho, e o saldo reservado volta para o disponível.',
  );

  protected tone(type: string): Tone | null {
    return TIMELINE_TONES[type] ?? null;
  }

  protected entryLabel(type: string): string {
    return LEDGER_LABELS[type] ?? type;
  }

  protected reload(): void {
    this.detail.reload();
    this.account.reload();
  }

  protected money(cents?: number | null): string {
    return ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
