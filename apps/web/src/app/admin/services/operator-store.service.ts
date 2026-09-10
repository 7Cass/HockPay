import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize, map, Observable, tap } from 'rxjs';
import { ApiClientService, toHttpParams } from '../domain/api-contracts';
import type { AdminStore, AdminStoreListItem, StoreLiveStatus } from '../domain/store';

export type LiveEnablementDecision = 'approve' | 'reject' | 'suspend';

/*
 * A forma da loja mora em `domain/store.ts`, não aqui.
 *
 * Ela é reexportada porque quem consome este serviço quase sempre quer o tipo
 * junto, e um `import` a mais por tela só para pegar a forma do que o método
 * acabou de devolver é atrito sem contrapartida.
 */
export type { AdminStore, AdminStoreListItem, StoreLiveStatus };

/** A condição comercial, como a mesa a decide: os três campos juntos. */
export interface CommercialTerms {
  feePercent: number;
  feeFixed: number;
  settlementDays: number;
}

/** As faixas que a entidade `Store` aceita. A tela avisa antes; ela decide. */
export const COMMERCIAL_TERMS_RANGE = {
  feePercent: { min: 0, max: 10 },
  feeFixed: { min: 0, max: 1000 },
  settlementDays: { min: 0, max: 90 },
} as const;

export interface ListOperatorStoresQuery {
  liveStatus?: StoreLiveStatus;
  limit?: number;
  offset?: number;
}

interface ListOperatorStoresResponse {
  data: AdminStoreListItem[];
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

  private readonly storeState = signal<AdminStore | null>(null);
  private readonly isStoreLoadingState = signal(false);
  private readonly storeErrorState = signal<string | null>(null);
  private readonly storesState = signal<AdminStoreListItem[]>([]);
  private readonly isLoadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly limitState = signal(20);
  private readonly offsetState = signal(0);

  readonly store = computed(() => this.storeState());
  readonly isStoreLoading = computed(() => this.isStoreLoadingState());
  readonly storeError = computed(() => this.storeErrorState());
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
   * Abre uma loja para investigar.
   *
   * Este GET escreve: ele grava `store.investigated` na trilha. É a exceção
   * deliberada de D11 — a alternativa, um POST /investigate separado, produz
   * uma trilha que registra só quem foi educado. Não há deduplicação: recarregar
   * a página grava outra linha, e duas linhas iguais são a verdade sobre o que
   * aconteceu.
   */
  loadStore(storeId: string): void {
    this.isStoreLoadingState.set(true);
    this.storeErrorState.set(null);
    this.storeState.set(null);

    this.api
      .get<{ store: AdminStore }>(`/operator/stores/${storeId}`)
      .pipe(finalize(() => this.isStoreLoadingState.set(false)))
      .subscribe({
        next: (response) => this.storeState.set(response.store),
        error: (err) => {
          this.storeErrorState.set(
            err.error?.error?.message || err.message || 'Erro ao carregar a loja',
          );
        },
      });
  }

  /**
   * Muda o que a loja paga e quanto ela espera, daqui para frente.
   *
   * Os três campos vão juntos porque não existe mudança parcial: a trilha
   * guarda a condição inteira nos dois lados, e um before/after que só carrega
   * o campo alterado obriga quem lê a reconstruir o resto de linhas antigas.
   */
  updateCommercialTerms(
    storeId: string,
    input: CommercialTerms & { reason: string },
  ): Observable<AdminStore> {
    return this.api
      .post<{ store: AdminStore }>(`/operator/stores/${storeId}/commercial-terms`, input)
      .pipe(
        map((response) => response.store),
        tap((store) => {
          this.storeState.set(store);
          this.patchInQueue(store);
        }),
      );
  }

  /**
   * Aprova, rejeita ou suspende a habilitação LIVE de uma loja.
   *
   * O motivo é obrigatório aqui e de novo no use case: um cliente HTTP direto
   * não passa por este formulário.
   */
  decide(
    storeId: string,
    decision: LiveEnablementDecision,
    reason: string,
  ): Observable<AdminStore> {
    return this.api
      .post<{ store: AdminStore }>(`/operator/stores/${storeId}/live-status`, {
        decision,
        reason,
      })
      .pipe(
        map((response) => response.store),
        tap((store) => {
          this.patchInQueue(store);
          if (this.storeState()?.id === store.id) {
            this.storeState.set(store);
          }
        }),
      );
  }

  /** Mantém a linha decidida na tela, com o estado novo, em vez de recarregar. */
  private patchInQueue(store: AdminStore): void {
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
