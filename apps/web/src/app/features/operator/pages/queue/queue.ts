import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInbox, lucideLoader2, lucideRefreshCcw } from '@ng-icons/lucide';
import { Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';

import {
  OperatorStoreListItem,
  OperatorStoreService,
} from '../../../../core/services/operator-store.service';
import type { StoreLiveStatus } from '../../../../core/services/store.service';
import { PageHeader, PageState, Sheet } from '../../../../shared/ui';
import {
  LIVE_STATUS_LABEL,
  LIVE_STATUS_TONE,
  type LiveEnablementDecision,
  decisionsFor,
} from '../../live-status';

const LIMIT = 20;

const FILTERS: ReadonlyArray<{ value: StoreLiveStatus | 'all'; label: string }> = [
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
  imports: [DatePipe, NgIcon, PageHeader, PageState, Sheet],
  providers: [provideIcons({ lucideInbox, lucideLoader2, lucideRefreshCcw })],
  templateUrl: './queue.html',
  styleUrl: './queue.css',
})
export class OperatorQueue implements OnInit, OnDestroy {
  protected readonly queue = inject(OperatorStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private routeSub?: Subscription;

  protected readonly filters = FILTERS;
  protected readonly statusLabel = LIVE_STATUS_LABEL;
  protected readonly statusTone = LIVE_STATUS_TONE;
  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  protected readonly filter = signal<StoreLiveStatus | 'all'>('PENDING');
  protected readonly offset = signal(0);

  /** A loja e a decisão que o painel está pedindo motivo para. */
  protected readonly pending = signal<{
    store: OperatorStoreListItem;
    decision: LiveEnablementDecision;
    label: string;
    consequence: string;
  } | null>(null);

  protected readonly reason = signal('');
  protected readonly isDeciding = signal(false);

  protected readonly page = computed(() => Math.floor(this.offset() / LIMIT) + 1);

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

  protected selectFilter(value: StoreLiveStatus | 'all'): void {
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
    store: OperatorStoreListItem,
    spec: { decision: LiveEnablementDecision; label: string; consequence: string },
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
      toast.error('O motivo é obrigatório — ele é a trilha.');
      return;
    }

    this.isDeciding.set(true);

    this.queue.decide(pending.store.id, pending.decision, reason).subscribe({
      next: (store) => {
        this.isDeciding.set(false);
        this.pending.set(null);
        toast.success(
          `${pending.store.name}: ${this.statusLabel[store.liveStatus].toLowerCase()}.`,
        );
      },
      error: (err: HttpErrorResponse) => {
        this.isDeciding.set(false);
        toast.error(err.error?.error?.message || 'Não foi possível registrar a decisão.');
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

  private parseFilter(value: string | null): StoreLiveStatus | 'all' {
    return VALID_STATUSES.includes(value as StoreLiveStatus)
      ? (value as StoreLiveStatus)
      : value === 'all'
        ? 'all'
        : 'PENDING';
  }
}
