import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize, map, Observable, tap } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { toHttpParams } from '../http/list-query';
import type { Store, StoreLiveStatus } from './store.service';

export type LiveEnablementDecision = 'approve' | 'reject' | 'suspend';

/**
 * O que a fila mostra sobre uma loja.
 *
 * Deliberadamente menos do que `Store`: a fila não carrega ledger, pagamento,
 * segredo nem chave. Investigar é outra tela, e ela pede a loja inteira por
 * outra rota.
 */
export interface OperatorStoreListItem {
  id: string;
  merchantId: string;
  name: string;
  slug: string;
  liveStatus: StoreLiveStatus;
  liveStatusReason?: string;
  liveStatusChangedAt?: string;
  createdAt: string;
}

export interface ListOperatorStoresQuery {
  liveStatus?: StoreLiveStatus;
  limit?: number;
  offset?: number;
}

interface ListOperatorStoresResponse {
  data: OperatorStoreListItem[];
  limit: number;
  offset: number;
}

/**
 * A fila da mesa e as decisões que ela toma sobre uma loja.
 *
 * A API pagina por `offset`/`limit` e não devolve total — a fila é uma pilha
 * de trabalho, não um relatório —, então a tela navega por "próxima" e
 * "anterior" e não por número de página.
 */
@Injectable({
  providedIn: 'root',
})
export class OperatorStoreService {
  private readonly api = inject(ApiClientService);

  private readonly storesState = signal<OperatorStoreListItem[]>([]);
  private readonly isLoadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly limitState = signal(20);
  private readonly offsetState = signal(0);

  readonly stores = computed(() => this.storesState());
  readonly isLoading = computed(() => this.isLoadingState());
  readonly error = computed(() => this.errorState());
  readonly limit = computed(() => this.limitState());
  readonly offset = computed(() => this.offsetState());

  /** Há mais páginas quando a atual veio cheia. Sem total, é o que se sabe. */
  readonly hasMore = computed(() => this.storesState().length >= this.limitState());

  loadQueue(query: ListOperatorStoresQuery = {}): void {
    this.isLoadingState.set(true);
    this.errorState.set(null);

    const params = toHttpParams({
      liveStatus: query.liveStatus,
      limit: query.limit,
      offset: query.offset,
    });

    this.api
      .get<ListOperatorStoresResponse>('/operator/stores', { params })
      .pipe(finalize(() => this.isLoadingState.set(false)))
      .subscribe({
        next: (response) => {
          this.storesState.set(response.data);
          this.limitState.set(response.limit);
          this.offsetState.set(response.offset);
        },
        error: (err) => {
          this.errorState.set(
            err.error?.error?.message || err.message || 'Erro ao carregar a fila',
          );
        },
      });
  }

  /**
   * Aprova, rejeita ou suspende a habilitação LIVE de uma loja.
   *
   * O motivo é obrigatório aqui e de novo no use case: um cliente HTTP direto
   * não passa por este formulário.
   */
  decide(storeId: string, decision: LiveEnablementDecision, reason: string): Observable<Store> {
    return this.api
      .post<{ store: Store }>(`/operator/stores/${storeId}/live-status`, { decision, reason })
      .pipe(
        map((response) => response.store),
        tap((store) => this.patchInQueue(store)),
      );
  }

  /** Mantém a linha decidida na tela, com o estado novo, em vez de recarregar. */
  private patchInQueue(store: Store): void {
    this.storesState.update((stores) =>
      stores.map((item) =>
        item.id === store.id
          ? {
              ...item,
              liveStatus: store.liveStatus,
              liveStatusReason: store.liveStatusReason,
              liveStatusChangedAt: store.liveStatusChangedAt,
            }
          : item,
      ),
    );
  }
}
