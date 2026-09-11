import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEyeOff, lucideReceipt, lucideRefreshCcw, lucideWebhook } from '@ng-icons/lucide';

import {
  OPERATOR_ENVIRONMENTS,
  OperatorInvestigationService,
  type OperatorEnvironment,
} from '../../../services/operator-investigation.service';
import type {
  OperatorRefundResult,
  OperatorWithdrawalResult,
} from '../../../services/operator-money.service';
import {
  PaymentStatus,
  type GetPaymentTimelineResponseDto,
  type PaymentObject,
} from '../../../domain/api-contracts';
import { WITHDRAWAL_POLICY, formatCents } from '../../../domain/money';
import {
  AdmButton,
  AdmChip,
  AdmFact,
  AdmFacts,
  AdmNotice,
  AdmPageState,
  AdmPagination,
  AdmPanel,
  AdmSegmented,
  type AdmSegmentedOption,
  AdmSheet,
  AdmStatusChip,
  AdmTable,
  AdmTimeline,
  type AdmTimelineEvent,
  AdmToastService,
} from '../../../ui';
import { OperatorRefundSheet } from '../money/refund-sheet';
import { OperatorWithdrawSheet } from '../money/withdraw-sheet';

type Tab = 'payments' | 'ledger' | 'webhooks';

const TABS: readonly AdmSegmentedOption<Tab>[] = [
  { value: 'payments', label: 'Pagamentos' },
  { value: 'ledger', label: 'Saldo e extrato' },
  { value: 'webhooks', label: 'Webhooks' },
];

/** TEST e LIVE, no formato que o segmentado espera. */
const ENVIRONMENTS: readonly AdmSegmentedOption<OperatorEnvironment>[] = OPERATOR_ENVIRONMENTS.map(
  (environment) => ({ value: environment, label: environment }),
);

/** Os únicos estados que o `CreateRefundUseCase` aceita estornar. */
const REFUNDABLE_STATUSES: readonly PaymentStatus[] = [
  PaymentStatus.CONFIRMED,
  PaymentStatus.RELEASED,
];

/**
 * A leitura que a mesa faz de uma loja para investigar um chamado.
 *
 * O seletor TEST/LIVE aqui é um parâmetro de consulta da mesa, e não tem
 * relação com o seletor do lojista, que é propriedade da sessão dele. Ele é
 * explícito porque a API o exige sem default: investigar produção e receber o
 * ledger TEST em silêncio produz a conclusão errada com dado certo.
 *
 * O que esta tela não tem é tão parte da lição quanto o que ela tem: não
 * existe aba de chaves de API, e o segredo do webhook aparece como "não
 * visível para operador" e não como campo em branco. Campo vazio parece bug;
 * a frase é a regra.
 *
 * Mover dinheiro pela loja sai daqui, e não de botões soltos na página: o
 * saque mora na aba de saldo, onde o disponível do ambiente já está na frente
 * de quem decide; o estorno mora na linha do tempo do pagamento, que é onde a
 * mesa já está quando descobre que ele precisa voltar.
 */
@Component({
  selector: 'app-operator-investigation',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    NgIcon,
    AdmButton,
    AdmChip,
    AdmFact,
    AdmFacts,
    AdmNotice,
    AdmPageState,
    AdmPagination,
    AdmPanel,
    AdmSegmented,
    AdmSheet,
    AdmStatusChip,
    AdmTable,
    AdmTimeline,
    OperatorRefundSheet,
    OperatorWithdrawSheet,
  ],
  providers: [provideIcons({ lucideEyeOff, lucideReceipt, lucideRefreshCcw, lucideWebhook })],
  templateUrl: './investigation.html',
  styleUrl: './investigation.css',
})
export class OperatorInvestigation {
  readonly storeId = input.required<string>();
  readonly storeName = input.required<string>();

  protected readonly reads = inject(OperatorInvestigationService);
  private readonly toast = inject(AdmToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly tabs = TABS;
  protected readonly environmentOptions = ENVIRONMENTS;
  protected readonly withdrawalPolicy = WITHDRAWAL_POLICY;

  protected readonly tab = signal<Tab>('payments');
  protected readonly environment = signal<OperatorEnvironment>('TEST');

  /** A linha do tempo aberta, e o pagamento que a pediu. */
  protected readonly timeline = signal<GetPaymentTimelineResponseDto | null>(null);
  protected readonly timelineFor = signal<PaymentObject | null>(null);
  protected readonly isTimelineLoading = signal(false);

  protected readonly isWithdrawOpen = signal(false);

  /** O pagamento sendo estornado, ou `null` com o painel fechado. */
  protected readonly refundFor = signal<PaymentObject | null>(null);

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      this.tab.set(parseTab(params.get('tab')));
      this.environment.set(params.get('env') === 'LIVE' ? 'LIVE' : 'TEST');
    });

    // Trocar de loja, de aba ou de ambiente é sempre uma leitura nova — e
    // fecha o que estava movendo dinheiro, que foi decidido sobre o que saiu
    // da tela.
    effect(() => {
      const storeId = this.storeId();
      const tab = this.tab();
      const environment = this.environment();

      if (!storeId) return;

      this.timeline.set(null);
      this.timelineFor.set(null);
      this.isWithdrawOpen.set(false);
      this.refundFor.set(null);
      this.loadTab(storeId, tab, environment);
    });
  }

  protected readonly ledgerTotal = computed(() => {
    const account = this.reads.account.data()?.account;
    return account ? account.available + account.pending + account.blocked : 0;
  });

  protected selectTab(tab: Tab): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'payments' ? null : tab },
      queryParamsHandling: 'merge',
    });
  }

  protected selectEnvironment(environment: OperatorEnvironment): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { env: environment === 'TEST' ? null : environment },
      queryParamsHandling: 'merge',
    });
  }

  protected reload(): void {
    this.loadTab(this.storeId(), this.tab(), this.environment());
  }

  protected goToPaymentsPage(page: number): void {
    this.reads.loadPayments(this.storeId(), this.environment(), { page });
  }

  protected goToTransactionsPage(page: number): void {
    this.reads.loadTransactions(this.storeId(), this.environment(), page);
  }

  protected openTimeline(payment: PaymentObject): void {
    this.timelineFor.set(payment);
    this.timeline.set(null);
    this.isTimelineLoading.set(true);

    this.reads.paymentTimeline(this.storeId(), payment.id, this.environment()).subscribe({
      next: (response) => {
        this.isTimelineLoading.set(false);
        this.timeline.set(response);
      },
      error: () => {
        this.isTimelineLoading.set(false);
        this.timelineFor.set(null);
        this.toast.bad('Não foi possível abrir a linha do tempo.');
      },
    });
  }

  /**
   * A linha do tempo da API na forma que o componente desenha.
   *
   * A tradução é de uma linha por campo e mora aqui, e não no componente: o
   * `adm-timeline` não deveria conhecer o DTO de pagamento para servir também à
   * próxima coisa que tiver história — um saque, uma disputa.
   */
  protected timelineEvents(result: GetPaymentTimelineResponseDto): readonly AdmTimelineEvent[] {
    return result.timeline.map((event) => ({
      id: event.id,
      title: event.title,
      at: event.occurredAt,
      description: event.description,
      meta: event.type,
    }));
  }

  protected closeTimeline(): void {
    this.timeline.set(null);
    this.timelineFor.set(null);
  }

  /**
   * O saque entrou. O saldo na tela ficou velho no mesmo instante — o valor
   * saiu do disponível para o bloqueado —, então a aba relê conta e extrato em
   * vez de remendar o número à mão.
   */
  protected onWithdrawn(result: OperatorWithdrawalResult): void {
    this.isWithdrawOpen.set(false);
    this.toast.ok(
      `Saque de ${formatCents(result.withdrawal.amount)} criado pela loja.`,
      `Saiu do disponível ${this.environment()} e está bloqueado até o envio. ` +
        `A trilha registrou o saldo antes e depois. Saque ${result.withdrawal.id}.`,
    );
    this.reads.loadAccount(this.storeId(), this.environment());
    this.reads.loadTransactions(this.storeId(), this.environment());
  }

  /** Estornável é o que a API aceitaria estornar: o estado certo, e sobra. */
  protected canRefund(payment: PaymentObject): boolean {
    return (
      REFUNDABLE_STATUSES.includes(payment.status) &&
      payment.amount - (payment.totalRefunded ?? 0) > 0
    );
  }

  /**
   * O estorno entrou. A linha do tempo reabre com o pagamento que a API
   * devolveu — com o estornado novo, e com o evento do estorno —, e a lista
   * relê a página em que estava.
   */
  protected onRefunded(result: OperatorRefundResult): void {
    this.refundFor.set(null);
    this.toast.ok(
      `Estorno de ${formatCents(result.refund.amount)} criado pela loja.`,
      `O pagamento tem agora ${formatCents(result.payment.totalRefunded ?? 0)} estornado. ` +
        'A trilha registrou o antes e o depois.',
    );
    this.reads.loadPayments(this.storeId(), this.environment(), {
      page: this.reads.payments.data()?.page,
    });
    this.openTimeline(result.payment);
  }

  private loadTab(storeId: string, tab: Tab, environment: OperatorEnvironment): void {
    switch (tab) {
      case 'payments':
        this.reads.loadPayments(storeId, environment);
        break;
      case 'ledger':
        this.reads.loadAccount(storeId, environment);
        this.reads.loadTransactions(storeId, environment);
        break;
      case 'webhooks':
        this.reads.loadWebhooks(storeId);
        this.reads.loadWebhookLogs(storeId);
        break;
    }
  }
}

function parseTab(value: string | null): Tab {
  return TABS.some((tab) => tab.value === value) ? (value as Tab) : 'payments';
}
