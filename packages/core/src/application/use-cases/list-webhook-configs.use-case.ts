import { IWebhookConfigRepository, WebhookConfig } from '../..';
import {
  CLOSED_WEBHOOK_CIRCUIT,
  IWebhookCircuitBreakerPort,
  WebhookCircuitSnapshot,
} from '../ports/webhook-circuit-breaker.port';

/**
 * Input for listing webhook configs.
 */
export interface IListWebhookConfigsInput {
  storeId: string;
}

export interface WebhookConfigWithCircuit {
  config: WebhookConfig;
  circuit: WebhookCircuitSnapshot;
}

/**
 * Output of listing webhook configs.
 */
export interface IListWebhookConfigsOutput {
  webhookConfigs: WebhookConfig[];
  /**
   * Estado do breaker por destino, na mesma ordem de `webhookConfigs`.
   *
   * Sem isto o lojista descobre que o endpoint dele caiu abrindo chamado
   * perguntando por que parou de receber evento. Quando nao ha breaker ligado
   * (API sem Redis, testes), todo destino aparece fechado -- e a verdade: nada
   * esta sendo barrado.
   */
  circuits: Record<string, WebhookCircuitSnapshot>;
}

/**
 * Use case for listing all webhook configurations for a store.
 */
export class ListWebhookConfigsUseCase {
  constructor(
    private readonly webhookConfigRepository: IWebhookConfigRepository,
    private readonly circuitBreaker?: IWebhookCircuitBreakerPort,
  ) {}

  async execute(input: IListWebhookConfigsInput): Promise<IListWebhookConfigsOutput> {
    const webhookConfigs = await this.webhookConfigRepository.findByStoreId(input.storeId);
    const circuits: Record<string, WebhookCircuitSnapshot> = {};

    for (const config of webhookConfigs) {
      circuits[config.id] = this.circuitBreaker
        ? await this.circuitBreaker.status(config.id)
        : CLOSED_WEBHOOK_CIRCUIT;
    }

    return { webhookConfigs, circuits };
  }
}
