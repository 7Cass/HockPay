import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { ApiClientService, toHttpParams } from '../domain/api-contracts';

export type OperatorAuditAction =
  | 'operator.login'
  | 'operator.logout'
  | 'store.live_approved'
  | 'store.live_rejected'
  | 'store.live_suspended'
  | 'store.commercial_terms_changed'
  | 'store.investigated';

/** Uma linha da trilha, como a API a devolve. */
export interface OperatorAuditLog {
  id: string;
  operatorId: string;
  action: OperatorAuditAction | string;
  targetType: string;
  targetId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface ListAuditLogsQuery {
  limit?: number;
  offset?: number;
  operatorId?: string;
}

interface ListAuditLogsResponse {
  data: OperatorAuditLog[];
  limit: number;
  offset: number;
}

/**
 * A trilha da mesa.
 *
 * É append-only e vem da mais nova para a mais antiga. Como a fila, ela pagina
 * por offset e não devolve total — uma trilha que cresce a cada investigação
 * não tem um "total" que valha a pena contar a cada página.
 */
@Injectable({
  providedIn: 'root',
})
export class OperatorAuditService {
  private readonly api = inject(ApiClientService);

  private readonly logsState = signal<OperatorAuditLog[]>([]);
  private readonly isLoadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly limitState = signal(50);
  private readonly offsetState = signal(0);

  readonly logs = computed(() => this.logsState());
  readonly isLoading = computed(() => this.isLoadingState());
  readonly error = computed(() => this.errorState());
  readonly limit = computed(() => this.limitState());
  readonly offset = computed(() => this.offsetState());
  readonly hasMore = computed(() => this.logsState().length >= this.limitState());

  loadLogs(query: ListAuditLogsQuery = {}): void {
    this.isLoadingState.set(true);
    this.errorState.set(null);

    const params = toHttpParams({
      limit: query.limit,
      offset: query.offset,
      operatorId: query.operatorId,
    });

    this.api
      .get<ListAuditLogsResponse>('/operator/audit-logs', { params })
      .pipe(finalize(() => this.isLoadingState.set(false)))
      .subscribe({
        next: (response) => {
          this.logsState.set(response.data);
          this.limitState.set(response.limit);
          this.offsetState.set(response.offset);
        },
        error: (err) => {
          this.errorState.set(
            err.error?.error?.message || err.message || 'Erro ao carregar a trilha',
          );
        },
      });
  }
}
