import type { HttpResourceRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, firstValueFrom } from 'rxjs';

import { ApiClientService, createIdempotencyKey } from '../domain/api-contracts';
import { type ApiFailure, toApiFailure } from '../domain/api-error';

/**
 * O que um comando devolve.
 *
 * Nem exceção nem string: quem chamou precisa decidir o que fazer, e decidir
 * exige o código. `Result` obriga a tela a olhar o caso ruim — um `await` que
 * ignora o retorno não compila para dentro de um `if`.
 */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: ApiFailure };

export interface CommandOptions {
  /**
   * A intenção, quando a rota exige `Idempotency-Key`.
   *
   * A chave é presa à intenção e não ao clique nem ao painel — a lição de
   * `2026-09-10`, quando a mesa aprendeu que chave por clique transforma
   * resposta perdida em segundo saque, e chave por painel faz a correção de um
   * valor digitado errado voltar `409 IDEMPOTENCY_KEY_CONFLICT`.
   *
   * O texto é a impressão digital do pedido: mesma intenção, mesma chave, até
   * dar certo. `MerchantApi` esquece a chave no sucesso.
   */
  readonly intent?: string;
}

/**
 * O encanamento do console: monta requisição de leitura e executa escrita.
 *
 * A leitura não passa por aqui como método — ela é um `httpResource` na camada
 * de dados de cada agregado, e o que este serviço dá é a URL e os parâmetros
 * já no formato que o recurso espera. A escrita passa, porque escrita tem
 * cabeçalho, idempotência e erro tipado, e nada disso deveria estar espalhado
 * por tela.
 */
@Injectable({ providedIn: 'root' })
export class MerchantApi {
  private readonly api = inject(ApiClientService);

  /** Chave viva por intenção, até o sucesso apagá-la. */
  private readonly intents = new Map<string, string>();

  /** A requisição que um `httpResource` de leitura consome. */
  request(path: string, params?: Record<string, string | number | boolean>): HttpResourceRequest {
    return { url: `${this.api.baseUrl}${path}`, params: clean(params) };
  }

  post<T>(path: string, body: unknown, options: CommandOptions = {}): Promise<Result<T>> {
    return this.run(this.api.post<T>(path, body, { headers: this.headers(options) }));
  }

  patch<T>(path: string, body: unknown, options: CommandOptions = {}): Promise<Result<T>> {
    return this.run(this.api.patch<T>(path, body, { headers: this.headers(options) }));
  }

  delete<T>(path: string, options: CommandOptions = {}): Promise<Result<T>> {
    return this.run(this.api.delete<T>(path, { headers: this.headers(options) }));
  }

  /**
   * Um `Observable` vira um `Result`.
   *
   * É público porque nem toda escrita do console sai daqui: as que passam pela
   * costura — `StoreService`, por exemplo — já chegam como `Observable` pronto,
   * e precisam do mesmo tratamento de falha. Uma segunda cópia de
   * `firstValueFrom` + `toApiFailure` seria um segundo lugar para a tradução de
   * erro divergir.
   */
  async run<T>(call: Observable<T>): Promise<Result<T>> {
    try {
      return { ok: true, value: await firstValueFrom(call) };
    } catch (error) {
      return { ok: false, failure: toApiFailure(error) };
    }
  }

  private headers(options: CommandOptions): Record<string, string> {
    if (!options.intent) return {};
    return { 'Idempotency-Key': this.keyFor(options.intent) };
  }

  private keyFor(intent: string): string {
    const existing = this.intents.get(intent);
    if (existing) return existing;

    const key = createIdempotencyKey('console');
    this.intents.set(intent, key);
    return key;
  }

  /** O sucesso fecha a intenção: o próximo pedido igual é um pedido novo. */
  forget(intent: string): void {
    this.intents.delete(intent);
  }
}

/** Parâmetro vazio não vai para a query string. */
function clean(
  params?: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  if (!params) return {};

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== undefined),
  );
}
