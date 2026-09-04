import {
  CLOSED_WEBHOOK_CIRCUIT,
  IWebhookCircuitBreakerPort,
  WebhookCircuitSnapshot,
} from '@hockpay/core';

/**
 * Subconjunto do ioredis de que o breaker precisa. Mantido estreito de
 * proposito: torna o servico testavel com um fake de tres metodos e deixa
 * explicito que ele nao guarda estado em memoria.
 */
export interface WebhookCircuitRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, px: 'PX', ttlMs: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export interface RedisWebhookCircuitBreakerOptions {
  /** Falhas de transporte seguidas antes de abrir. */
  failureThreshold?: number;
  /** Quanto tempo o destino fica aberto antes de ganhar uma nova chance. */
  openMs?: number;
  keyPrefix?: string;
  now?: () => Date;
}

interface StoredCircuit {
  failures: number;
  openUntil?: number;
}

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_OPEN_MS = 60_000;

/**
 * Circuit breaker por `webhookConfig`, com estado no Redis.
 *
 * O estado precisa ser compartilhado, e nao por processo: com dois workers, um
 * breaker em memoria deixaria metade das entregas continuar batendo no destino
 * morto -- o gargalo voltaria pela porta dos fundos.
 *
 * A entrada expira sozinha (TTL) quando ninguem mais fala com aquele destino,
 * entao nao ha lixo acumulando para configs deletadas.
 */
export class RedisWebhookCircuitBreakerService implements IWebhookCircuitBreakerPort {
  private readonly failureThreshold: number;
  private readonly openMs: number;
  private readonly keyPrefix: string;
  private readonly now: () => Date;

  constructor(
    private readonly redis: WebhookCircuitRedisClient,
    options: RedisWebhookCircuitBreakerOptions = {},
  ) {
    this.failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.openMs = options.openMs ?? DEFAULT_OPEN_MS;
    this.keyPrefix = options.keyPrefix ?? 'webhook:circuit:';
    this.now = options.now ?? (() => new Date());
  }

  async shouldAttempt(configId: string): Promise<boolean> {
    const snapshot = await this.status(configId);
    return snapshot.state === 'closed';
  }

  async recordSuccess(configId: string): Promise<void> {
    await this.redis.del(this.key(configId));
  }

  async recordTransportFailure(configId: string): Promise<WebhookCircuitSnapshot> {
    const stored = await this.read(configId);
    const failures = stored.failures + 1;
    const nowMs = this.now().getTime();

    const next: StoredCircuit =
      failures >= this.failureThreshold
        ? { failures, openUntil: nowMs + this.openMs }
        : { failures };

    // O TTL cobre a janela aberta inteira mais folga para a contagem sobreviver
    // entre tentativas espacadas pelo backoff do BullMQ.
    await this.redis.set(this.key(configId), JSON.stringify(next), 'PX', this.openMs * 10);

    return this.toSnapshot(next, nowMs);
  }

  async status(configId: string): Promise<WebhookCircuitSnapshot> {
    const stored = await this.read(configId);
    return this.toSnapshot(stored, this.now().getTime());
  }

  private toSnapshot(stored: StoredCircuit, nowMs: number): WebhookCircuitSnapshot {
    const isOpen = stored.openUntil !== undefined && stored.openUntil > nowMs;

    return {
      state: isOpen ? 'open' : 'closed',
      consecutiveFailures: stored.failures,
      ...(isOpen ? { openUntil: new Date(stored.openUntil as number) } : {}),
    };
  }

  /**
   * Um Redis fora do ar nao pode derrubar a entrega: sem estado legivel, o
   * destino e tratado como fechado e a tentativa acontece. O breaker e uma
   * protecao contra lentidao, nao um pre-requisito para entregar.
   */
  private async read(configId: string): Promise<StoredCircuit> {
    let raw: string | null;
    try {
      raw = await this.redis.get(this.key(configId));
    } catch {
      return { failures: CLOSED_WEBHOOK_CIRCUIT.consecutiveFailures };
    }

    if (!raw) return { failures: 0 };

    try {
      const parsed = JSON.parse(raw) as StoredCircuit;
      return {
        failures: typeof parsed.failures === 'number' ? parsed.failures : 0,
        openUntil: typeof parsed.openUntil === 'number' ? parsed.openUntil : undefined,
      };
    } catch {
      return { failures: 0 };
    }
  }

  private key(configId: string): string {
    return `${this.keyPrefix}${configId}`;
  }
}
