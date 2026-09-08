import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEyeOff, lucideReceipt, lucideRefreshCcw, lucideWebhook } from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';

import {
  OPERATOR_ENVIRONMENTS,
  OperatorInvestigationService,
  type OperatorEnvironment,
} from '../../../../../core/services/operator-investigation.service';
import type {
  GetPaymentTimelineResponseDto,
  PaymentObject,
} from '../../../../../core/services/payment.service';
import { PageState, Sheet, StatusChip } from '../../../../../shared/ui';

type Tab = 'payments' | 'ledger' | 'webhooks';

const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: 'payments', label: 'Pagamentos' },
  { value: 'ledger', label: 'Saldo e extrato' },
  { value: 'webhooks', label: 'Webhooks' },
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
 */
@Component({
  selector: 'app-operator-investigation',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, NgIcon, PageState, Sheet, StatusChip],
  providers: [provideIcons({ lucideEyeOff, lucideReceipt, lucideRefreshCcw, lucideWebhook })],
  templateUrl: './investigation.html',
  styleUrl: './investigation.css',
})
export class OperatorInvestigation {
  readonly storeId = input.required<string>();

  protected readonly reads = inject(OperatorInvestigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly tabs = TABS;
  protected readonly environments = OPERATOR_ENVIRONMENTS;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  protected readonly tab = signal<Tab>('payments');
  protected readonly environment = signal<OperatorEnvironment>('TEST');

  /** A linha do tempo aberta, e o pagamento que a pediu. */
  protected readonly timeline = signal<GetPaymentTimelineResponseDto | null>(null);
  protected readonly timelineFor = signal<PaymentObject | null>(null);
  protected readonly isTimelineLoading = signal(false);

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      this.tab.set(parseTab(params.get('tab')));
      this.environment.set(params.get('env') === 'LIVE' ? 'LIVE' : 'TEST');
    });

    // Trocar de loja, de aba ou de ambiente é sempre uma leitura nova.
    effect(() => {
      const storeId = this.storeId();
      const tab = this.tab();
      const environment = this.environment();

      if (!storeId) return;

      this.timeline.set(null);
      this.timelineFor.set(null);
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
        toast.error('Não foi possível abrir a linha do tempo.');
      },
    });
  }

  protected closeTimeline(): void {
    this.timeline.set(null);
    this.timelineFor.set(null);
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
