/**
 * Port: Webhook Sender
 *
 * Interface for sending HTTP webhooks.
 * This port is implemented in the infrastructure layer using fetch/axios.
 */
export interface IWebhookSenderPort {
  /**
   * Send a webhook to the target URL.
   *
   * @param url - The webhook URL
   * @param payload - The payload to send
   * @param headers - Additional headers to include
   * @returns The response status code and body
   */
  send(
    url: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<WebhookResponse>;
}

/**
 * Por que a entrega falhou.
 *
 * A distincao existe para o circuit breaker: o que denuncia um destino doente e
 * o socket que pendura, nao o status que o merchant escolheu responder. Um 4xx
 * chega rapido e e resposta legitima da aplicacao dele; um timeout consome os
 * 30s inteiros e e o que trava a fila para todo mundo.
 *
 * - `transport`: nao houve resposta. Timeout, DNS, recusa de conexao.
 * - `response`: o destino respondeu, com status de erro ou redirect invalido.
 * - `blocked`: a politica de URL recusou antes de abrir socket.
 */
export type WebhookFailureKind = 'transport' | 'response' | 'blocked';

/**
 * Webhook response structure.
 */
export interface WebhookResponse {
  statusCode: number;
  body?: string;
  success: boolean;
  /** Presente somente quando `success` e falso. */
  failureKind?: WebhookFailureKind;
}
