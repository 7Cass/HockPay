import { httpResource } from '@angular/common/http';
import { Signal, inject } from '@angular/core';

import { MerchantApi, type Result } from './api';

/* ── Chaves de API ───────────────────────────────────────────────────────── */

export interface ApiKey {
  readonly id: string;
  readonly name: string;
  readonly prefix: string;
  readonly environment: 'TEST' | 'LIVE' | string;
  readonly createdAt: string;
  readonly lastUsedAt?: string;
  /** Presente quando a chave já foi revogada — ela continua na lista. */
  readonly revokedAt?: string;
}

export function apiKeysResource() {
  const api = inject(MerchantApi);

  return httpResource<{ apiKeys: readonly ApiKey[] }>(() => api.request('/api-keys'), {
    defaultValue: { apiKeys: [] },
  });
}

/* ── Webhooks ────────────────────────────────────────────────────────────── */

export interface WebhookCircuit {
  readonly state: 'closed' | 'open';
  readonly consecutiveFailures: number;
  readonly openUntil?: string;
}

export interface Webhook {
  readonly id: string;
  readonly url: string;
  readonly prefix: string;
  readonly events: readonly string[];
  readonly isActive: boolean;
  readonly circuit?: WebhookCircuit;
  readonly createdAt: string;
}

export type DeliveryStatus = 'PENDING' | 'DELIVERED' | 'FAILED_RETRYABLE' | 'FAILED_FINAL';

export interface WebhookLog {
  readonly id: string;
  readonly eventType: string;
  readonly deliveryId: string;
  readonly requestId?: string;
  readonly responseStatus?: number;
  readonly responseBody?: string;
  readonly status?: DeliveryStatus;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly nextRetryAt?: string;
  readonly deliveredAt?: string;
  readonly failedAt?: string;
  readonly lastError?: string;
  readonly createdAt: string;
}

export interface InboxEvent {
  readonly id: string;
  readonly eventType: string;
  readonly deliveryId?: string;
  readonly requestId?: string;
  readonly signatureValid: boolean;
  readonly receivedAt: string;
}

export function webhooksResource() {
  const api = inject(MerchantApi);

  return httpResource<{ webhooks: readonly Webhook[] }>(() => api.request('/webhooks'), {
    defaultValue: { webhooks: [] },
  });
}

/** O histórico de entregas de um destino. `id` vazio não busca nada. */
export function webhookLogsResource(id: Signal<string>, status: Signal<string>) {
  const api = inject(MerchantApi);

  return httpResource<{ logs: readonly WebhookLog[]; total: number }>(
    () =>
      id()
        ? api.request(`/webhooks/${id()}/logs`, {
            limit: 50,
            ...(status() ? { status: status() } : {}),
          })
        : undefined,
    { defaultValue: { logs: [], total: 0 } },
  );
}

/** O que a inbox de teste recebeu de volta — só o destino de dev tem isso. */
export function inboxEventsResource(id: Signal<string>) {
  const api = inject(MerchantApi);

  return httpResource<{ events: readonly InboxEvent[]; total: number }>(
    () => (id() ? api.request(`/webhooks/${id()}/inbox-events`, { limit: 50 }) : undefined),
    { defaultValue: { events: [], total: 0 } },
  );
}

/* ── Alertas ─────────────────────────────────────────────────────────────── */

export interface Alert {
  readonly id: string;
  readonly name: string;
  readonly channel: 'discord';
  readonly configPreview: { readonly webhookUrl: string };
  readonly events: readonly string[];
  readonly isActive: boolean;
  readonly createdAt: string;
}

export interface AlertLog {
  readonly id: string;
  readonly eventType: string;
  readonly channel: string;
  readonly status: 'PENDING' | 'DELIVERED' | 'FAILED';
  readonly responseStatus?: number;
  readonly errorMessage?: string;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly deliveredAt?: string;
  readonly createdAt: string;
}

export function alertsResource() {
  const api = inject(MerchantApi);

  return httpResource<{ alerts: readonly Alert[] }>(() => api.request('/alerts'), {
    defaultValue: { alerts: [] },
  });
}

export function alertLogsResource(id: Signal<string>) {
  const api = inject(MerchantApi);

  return httpResource<{ logs: readonly AlertLog[]; total: number }>(
    () => (id() ? api.request(`/alerts/${id()}/logs`, { limit: 50 }) : undefined),
    { defaultValue: { logs: [], total: 0 } },
  );
}

/* ── Comandos ────────────────────────────────────────────────────────────── */

/**
 * As escritas da integração.
 *
 * Duas delas devolvem **segredo que só existe uma vez**: a chave de API em
 * claro e o segredo de assinatura do webhook. A tela mostra e avisa; a API não
 * guarda cópia legível, e recarregar não traz de volta.
 */
export class IntegrationCommands {
  constructor(private readonly api: MerchantApi) {}

  createKey(input: {
    name: string;
    environment: string;
  }): Promise<Result<ApiKey & { plainKey: string }>> {
    return this.api.post('/api-keys', input);
  }

  revokeKey(id: string): Promise<Result<unknown>> {
    return this.api.post(`/api-keys/${id}/revoke`, {});
  }

  createWebhook(input: {
    url: string;
    events: readonly string[];
  }): Promise<Result<Webhook & { secret: string }>> {
    return this.api.post('/webhooks', input);
  }

  /** O destino de teste da própria API: entrega assinada que volta para cá. */
  createInbox(): Promise<Result<Webhook & { secret: string }>> {
    return this.api.post('/webhooks/inbox', {});
  }

  setWebhookActive(id: string, isActive: boolean): Promise<Result<unknown>> {
    return this.api.patch(`/webhooks/${id}`, { isActive });
  }

  deleteWebhook(id: string): Promise<Result<void>> {
    return this.api.delete(`/webhooks/${id}`);
  }

  testWebhook(id: string): Promise<Result<unknown>> {
    return this.api.post(`/webhooks/${id}/test`, {});
  }

  retryDelivery(id: string, logId: string): Promise<Result<unknown>> {
    return this.api.post(`/webhooks/${id}/logs/${logId}/retry`, {});
  }

  createAlert(input: {
    name: string;
    channel: 'discord';
    discord: { webhookUrl: string };
    events: readonly string[];
    isActive: boolean;
  }): Promise<Result<{ alert: Alert }>> {
    return this.api.post('/alerts', input);
  }

  updateAlert(
    id: string,
    input: {
      name?: string;
      discord?: { webhookUrl: string };
      events?: readonly string[];
      isActive?: boolean;
    },
  ): Promise<Result<{ alert: Alert }>> {
    return this.api.patch(`/alerts/${id}`, input);
  }

  deleteAlert(id: string): Promise<Result<void>> {
    return this.api.delete(`/alerts/${id}`);
  }

  testAlert(id: string): Promise<Result<unknown>> {
    return this.api.post(`/alerts/${id}/test`, {});
  }

  retryAlert(id: string, logId: string): Promise<Result<unknown>> {
    return this.api.post(`/alerts/${id}/logs/${logId}/retry`, {});
  }
}

export function integrationCommands(): IntegrationCommands {
  return new IntegrationCommands(inject(MerchantApi));
}
