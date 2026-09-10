import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInbox, lucideRefreshCcw } from '@ng-icons/lucide';
import { Subscription } from 'rxjs';

import { OperatorStoreService } from '../../services/operator-store.service';
import type { AdminStoreListItem, StoreLiveStatus } from '../../domain/store';
import {
  AdmButton,
  AdmChip,
  AdmCopy,
  AdmField,
  AdmPageHeader,
  AdmPageState,
  AdmPagination,
  AdmPanel,
  AdmSegmented,
  type AdmSegmentedOption,
  AdmSheet,
  AdmSkeletonRows,
  AdmTable,
  AdmToastService,
} from '../../ui';
import {
  LIVE_STATUS_LABEL,
  LIVE_STATUS_TONE,
  type LiveEnablementDecision,
  decisionsFor,
} from '../../domain/live-status';

const LIMIT = 20;

type QueueFilter = StoreLiveStatus | 'all';

const FILTERS: readonly AdmSegmentedOption<QueueFilter>[] = [
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'APPROVED', label: 'Aprovadas' },
  { value: 'SUSPENDED', label: 'Suspensas' },
  { value: 'REJECTED', label: 'Rejeitadas' },
  { value: 'NOT_REQUESTED', label: 'Não pedidas' },
  { value: 'all', label: 'Todas' },
];

const VALID_STATUSES = FILTERS.map((filter) => filter.value);

/**
 * A fila de habilitação LIVE.
 *
 * O nome da loja abre a investigação — e abrir grava `store.investigated` na
 * trilha. Por isso a fila não pré-carrega nada da loja: quem passa o olho na
 * fila não deixa linha, quem abre deixa.
 *
 * Abre em `PENDING` porque é o que pede decisão; os outros estados existem para
 * revisar o que já foi decidido — suspender uma loja aprovada é tão parte do
 * trabalho quanto aprovar uma pendente.
 *
 * Cada decisão passa pelo mesmo painel, com o motivo obrigatório e a
 * consequência escrita antes da pergunta. O motivo é exigido de novo no use
 * case: este formulário é conveniência, não a regra.
 */
@Component({
  selector: 'app-operator-queue',
  standalone: true,
  imports: [
    DatePipe,
    NgIcon,
    RouterLink,
    AdmButton,
    AdmChip,
    AdmCopy,
    AdmField,
    AdmPageHeader,
    AdmPageState,
    AdmPagination,
    AdmPanel,
    AdmSegmented,
    AdmSheet,
    AdmSkeletonRows,
    AdmTable,
  ],
  providers: [provideIcons({ lucideInbox, lucideRefreshCcw })],
  templateUrl: './queue.html',
  styleUrl: './queue.css',
})
export class OperatorQueue implements OnInit, OnDestroy {
  protected readonly queue = inject(OperatorStoreService);
  private readonly toast = inject(AdmToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private routeSub?: Subscription;

  protected readonly filters = FILTERS;
  protected readonly statusLabel = LIVE_STATUS_LABEL;
  protected readonly statusTone = LIVE_STATUS_TONE;

  protected readonly filter = signal<QueueFilter>('PENDING');
  protected readonly offset = signal(0);

  /** A loja e a decisão que o painel está pedindo motivo para. */
  protected readonly pending = signal<{
    store: AdminStoreListItem;
    decision: LiveEnablementDecision;
    label: string;
    consequence: string;
    to: StoreLiveStatus;
  } | null>(null);

  protected readonly reason = signal('');
  protected readonly isDeciding = signal(false);

  protected readonly page = computed(() => Math.floor(this.offset() / LIMIT) + 1);

  /**
   * A faixa que esta página cobre — "21–40", por exemplo.
   *
   * A API pagina por offset e não devolve total (a fila é pilha de trabalho,
   * não relatório), então não há "de N". O que dá para dizer com honestidade é
   * onde se está, e é melhor do que o "página 2" solto: ele não responde nem
   * quantas lojas há na tela.
   */
  protected readonly range = computed(() => {
    const count = this.queue.stores().length;
    if (count === 0) return '';
    const first = this.offset() + 1;
    return `${first}–${this.offset() + count} · página ${this.page()}`;
  });

  ngOnInit(): void {
    this.routeSub = this.route.queryParamMap.subscribe((params) => {
      this.filter.set(this.parseFilter(params.get('liveStatus')));
      this.offset.set(Math.max(Number(params.get('offset') ?? 0) || 0, 0));
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  protected reload(): void {
    this.load();
  }

  protected selectFilter(value: QueueFilter): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { liveStatus: value === 'all' ? null : value, offset: null },
      queryParamsHandling: 'merge',
    });
  }

  protected goToOffset(offset: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { offset: offset > 0 ? offset : null },
      queryParamsHandling: 'merge',
    });
  }

  protected decisionsFor(status: StoreLiveStatus) {
    return decisionsFor(status);
  }

  protected ask(
    store: AdminStoreListItem,
    spec: {
      decision: LiveEnablementDecision;
      label: string;
      consequence: string;
      to: StoreLiveStatus;
    },
  ): void {
    this.reason.set('');
    this.pending.set({ store, ...spec });
  }

  protected closeSheet(): void {
    if (this.isDeciding()) return;
    this.pending.set(null);
  }

  protected setReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected confirm(): void {
    const pending = this.pending();
    const reason = this.reason().trim();

    if (!pending || this.isDeciding()) return;

    if (!reason) {
      this.toast.bad('O motivo é obrigatório — ele é a trilha.');
      return;
    }

    this.isDeciding.set(true);

    this.queue.decide(pending.store.id, pending.decision, reason).subscribe({
      next: (store) => {
        this.isDeciding.set(false);
        this.pending.set(null);
        this.toast.ok(
          `${pending.store.name}: ${this.statusLabel[store.liveStatus].toLowerCase()}.`,
          'A linha já está na trilha, com o motivo.',
        );
      },
      error: (err: HttpErrorResponse) => {
        this.isDeciding.set(false);
        this.toast.bad(err.error?.error?.message || 'Não foi possível registrar a decisão.');
      },
    });
  }

  protected emptyMessage(): string {
    return this.filter() === 'PENDING'
      ? 'Nenhuma loja esperando decisão. A fila vazia é o estado bom.'
      : 'Nenhuma loja neste estado.';
  }

  private load(): void {
    const filter = this.filter();
    this.queue.loadQueue({
      liveStatus: filter === 'all' ? undefined : filter,
      limit: LIMIT,
      offset: this.offset(),
    });
  }

  private parseFilter(value: string | null): QueueFilter {
    return VALID_STATUSES.includes(value as StoreLiveStatus)
      ? (value as StoreLiveStatus)
      : value === 'all'
        ? 'all'
        : 'PENDING';
  }
}
