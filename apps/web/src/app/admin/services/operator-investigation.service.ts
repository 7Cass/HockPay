import { inject, Injectable, signal, type Signal } from '@angular/core';
import { finalize, Observable } from 'rxjs';
import { ApiClientService, toHttpParams } from '../domain/api-contracts';
import type {
  GetPaymentTimelineResponseDto,
  PaymentObject,
  PaymentStatus,
  TransactionObject,
  WebhookConfig,
  WebhookLog,
} from '../domain/api-contracts';

/** O ambiente que a mesa está investigando. Obrigatório, e sem default. */
export type OperatorEnvironment = 'TEST' | 'LIVE';

export const OPERATOR_ENVIRONMENTS: readonly OperatorEnvironment[] = ['TEST', 'LIVE'];

export interface Account {
  id: string;
  storeId: string;
  environment: OperatorEnvironment;
  available: number;
  pending: number;
  blocked: number;
  currency: string;
  updatedAt: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Uma seção da investigação: o que ela carregou, se está carregando, e o que
 * deu errado.
 *
 * Existe para que as cinco leituras não repitam o mesmo trio de signals cinco
 * vezes — e para que a tela leia todas do mesmo jeito.
 */
class Section<T> {
  private readonly dataState = signal<T | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly data: Signal<T | null> = this.dataState.asReadonly();
  readonly isLoading: Signal<boolean> = this.loadingState.asReadonly();
  readonly error: Signal<string | null> = this.errorState.asReadonly();

  load(request: Observable<T>): void {
    this.loadingState.set(true);
    this.errorState.set(null);

    request.pipe(finalize(() => this.loadingState.set(false))).subscribe({
      next: (value) => this.dataState.set(value),
      error: (err) => {
        this.dataState.set(null);
        this.errorState.set(err.error?.error?.message || err.message || 'Erro ao carregar');
      },
    });
  }

  reset(): void {
    this.dataState.set(null);
    this.errorState.set(null);
    this.loadingState.set(false);
  }
}

/**
 * As leituras que a mesa faz para investigar um chamado.
 *
 * Todas batem nas rotas de operador, que reusam os mesmos use cases do
 * dashboard do lojista trocando só a origem do `storeId`. O operador lê
 * exatamente o que o lojista lê, de uma loja que ele escolhe — não existe
 * caminho de leitura paralelo, e por isso não existe um segundo lugar onde o
 * vazamento possa nascer.
 *
 * `environment` vai explícito em toda leitura que é por ambiente. Não há
 * default: um operador que investiga produção e recebe o ledger TEST em
 * silêncio tira a conclusão errada com dado certo.
 */
@Injectable({
  providedIn: 'root',
})
export class OperatorInvestigationService {
  private readonly api = inject(ApiClientService);

  readonly payments = new Section<{ payments: PaymentObject[] } & PageMeta>();
  readonly account = new Section<{ account: Account }>();
  readonly transactions = new Section<{ data: TransactionObject[]; meta: PageMeta }>();
  readonly webhooks = new Section<{ webhooks: WebhookConfig[] }>();
  readonly webhookLogs = new Section<{ logs: WebhookLog[]; total: number; page: number }>();

  loadPayments(
    storeId: string,
    environment: OperatorEnvironment,
    query: { page?: number; status?: PaymentStatus; externalId?: string } = {},
  ): void {
    const params = toHttpParams({
      environment,
      page: query.page,
      limit: 20,
      status: query.status,
      externalId: query.externalId,
    });

    this.payments.load(
      this.api.get<{ payments: PaymentObject[] } & PageMeta>(
        `/operator/stores/${storeId}/payments`,
        { params },
      ),
    );
  }

  loadAccount(storeId: string, environment: OperatorEnvironment): void {
    this.account.load(
      this.api.get<{ account: Account }>(`/operator/stores/${storeId}/account`, {
        params: toHttpParams({ environment }),
      }),
    );
  }

  loadTransactions(storeId: string, environment: OperatorEnvironment, page = 1): void {
    this.transactions.load(
      this.api.get<{ data: TransactionObject[]; meta: PageMeta }>(
        `/operator/stores/${storeId}/transactions`,
        { params: toHttpParams({ environment, page, limit: 20 }) },
      ),
    );
  }

  /**
   * Config de webhook e entregas não pedem ambiente: as duas são escopadas por
   * loja e não têm coluna de ambiente. Exigir um parâmetro que a rota depois
   * ignora seria a mesma mentira pequena que o resto disto evita.
   */
  loadWebhooks(storeId: string): void {
    this.webhooks.load(
      this.api.get<{ webhooks: WebhookConfig[] }>(`/operator/stores/${storeId}/webhooks`),
    );
  }

  loadWebhookLogs(storeId: string, configId?: string, page = 1): void {
    this.webhookLogs.load(
      this.api.get<{ logs: WebhookLog[]; total: number; page: number }>(
        `/operator/stores/${storeId}/webhooks/logs`,
        { params: toHttpParams({ configId, page, limit: 20 }) },
      ),
    );
  }

  /** A linha do tempo de um pagamento. Carregada sob demanda, sem estado. */
  paymentTimeline(
    storeId: string,
    paymentId: string,
    environment: OperatorEnvironment,
  ): Observable<GetPaymentTimelineResponseDto> {
    return this.api.get<GetPaymentTimelineResponseDto>(
      `/operator/stores/${storeId}/payments/${paymentId}/timeline`,
      { params: toHttpParams({ environment }) },
    );
  }

  resetAll(): void {
    this.payments.reset();
    this.account.reset();
    this.transactions.reset();
    this.webhooks.reset();
    this.webhookLogs.reset();
  }
}
