/**
 * Port: Circuit breaker por destino de webhook.
 *
 * O problema concreto: o processor de entrega roda com um numero fixo de slots.
 * Um destino que aceita a conexao e nao responde consome os 30s inteiros de
 * timeout por evento, e enquanto isso os eventos de outros lojistas esperam.
 * Cinquenta eventos pendentes de um destino pendurado seguram a fila por
 * dezenas de minutos, e ainda vem o backoff de 1, 2, 4 e 8 minutos.
 *
 * O breaker corta isso na raiz: depois de N falhas de transporte consecutivas o
 * destino entra em aberto, e as entregas seguintes falham na hora, sem abrir
 * socket. O estado mora no Redis, e nao em memoria, para o worker continuar
 * escalando horizontalmente -- dois workers precisam enxergar o mesmo destino
 * como aberto.
 *
 * Meio-aberto nao e um estado separado aqui: quando `openUntil` passa, a
 * proxima tentativa vai. Se ela falhar de novo, o contador ainda esta no teto e
 * o destino reabre imediatamente. Um sucesso zera tudo.
 */
export type WebhookCircuitState = 'closed' | 'open';

export interface WebhookCircuitSnapshot {
  state: WebhookCircuitState;
  /** Falhas de transporte seguidas. Zera no primeiro sucesso. */
  consecutiveFailures: number;
  /** Quando o destino volta a receber uma tentativa. Ausente se fechado. */
  openUntil?: Date;
}

export const CLOSED_WEBHOOK_CIRCUIT: WebhookCircuitSnapshot = {
  state: 'closed',
  consecutiveFailures: 0,
};

export interface IWebhookCircuitBreakerPort {
  /**
   * `false` significa "nao abra socket agora". Chamado antes de cada entrega.
   */
  shouldAttempt(configId: string): Promise<boolean>;

  /** Zera o contador. Chamado quando o destino responde com sucesso. */
  recordSuccess(configId: string): Promise<void>;

  /**
   * Conta uma falha de transporte. Somente `transport`: um 4xx e resposta
   * legitima da aplicacao do lojista e nao diz nada sobre a saude do destino,
   * e um `blocked` nem chega a abrir socket.
   */
  recordTransportFailure(configId: string): Promise<WebhookCircuitSnapshot>;

  /** Estado atual, para expor ao lojista. Nao altera nada. */
  status(configId: string): Promise<WebhookCircuitSnapshot>;
}
