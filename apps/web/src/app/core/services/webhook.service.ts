import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';

/**
 * Webhook Config Business Entity
 */
/**
 * Estado do circuit breaker daquele destino. O worker abre o circuito depois de
 * falhas de transporte seguidas (timeout, DNS, recusa), e enquanto ele estiver
 * aberto nenhuma entrega e tentada -- e por isso que o lojista precisa ver.
 */
export interface WebhookCircuit {
  state: 'closed' | 'open';
  consecutiveFailures: number;
  openUntil?: string;
}

export interface WebhookConfig {
  id: string;
  url: string;
  prefix: string;
  events: string[];
  isActive: boolean;
  circuit?: WebhookCircuit;
  createdAt: string;
  updatedAt: string;
}

/**
 * Webhook Creation Response (Includes one-time plain secret)
 */
export interface CreateWebhookConfigResponse extends WebhookConfig {
  secret: string; // ONLY RETURNED ON CREATION
}

/**
 * Webhook Log
 */
export type WebhookDeliveryStatus = 'PENDING' | 'DELIVERED' | 'FAILED_RETRYABLE' | 'FAILED_FINAL';

export interface WebhookLog {
  id: string;
  configId: string;
  paymentId?: string;
  outboxEventId?: string;
  requestId?: string;
  deliveryId: string;
  eventType: string;
  payload: any;
  requestHeaders?: any;
  responseStatus?: number;
  responseBody?: string;
  status?: WebhookDeliveryStatus;
  attempt: number;
  maxAttempts: number;
  nextRetryAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  lastError?: string;
  createdAt: string;
}

export interface WebhookInboxEvent {
  id: string;
  storeId: string;
  configId: string;
  eventType: string;
  payload: any;
  requestHeaders?: Record<string, string>;
  requestId?: string;
  deliveryId?: string;
  outboxEventId?: string;
  paymentId?: string;
  signatureValid: boolean;
  receivedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class WebhookService {
  private readonly apiClient = inject(ApiClientService);

  /**
   * List all webhook configs for the current store
   */
  list(): Observable<{ webhooks: WebhookConfig[] }> {
    return this.apiClient.get<{ webhooks: WebhookConfig[] }>('/webhooks');
  }

  /**
   * Get a single webhook config
   */
  get(id: string): Observable<{ webhook: WebhookConfig }> {
    return this.apiClient.get<{ webhook: WebhookConfig }>(`/webhooks/${id}`);
  }

  /**
   * Create a new webhook
   * WARNING: The secret is only returned once in this response!
   */
  create(data: { url: string; events: string[] }): Observable<CreateWebhookConfigResponse> {
    return this.apiClient.post<CreateWebhookConfigResponse>('/webhooks', data);
  }

  /**
   * Create an internal test inbox webhook.
   */
  createInbox(data?: { events?: string[] }): Observable<CreateWebhookConfigResponse> {
    return this.apiClient.post<CreateWebhookConfigResponse>('/webhooks/inbox', data ?? {});
  }

  /**
   * Update an existing webhook
   */
  update(
    id: string,
    data: { url?: string; events?: string[]; isActive?: boolean },
  ): Observable<{ webhook: WebhookConfig }> {
    return this.apiClient.patch<{ webhook: WebhookConfig }>(`/webhooks/${id}`, data);
  }

  /**
   * Delete a webhook
   */
  delete(id: string): Observable<void> {
    return this.apiClient.delete<void>(`/webhooks/${id}`);
  }

  /**
   * Send a test ping webhook
   */
  test(id: string): Observable<any> {
    return this.apiClient.post<any>(`/webhooks/${id}/test`, {});
  }

  /**
   * List webhook delivery logs
   */
  listLogs(
    id: string,
    params?: { page?: number; limit?: number; status?: 'delivered' | 'failed' | 'pending' },
  ): Observable<{ logs: WebhookLog[]; total: number; page: number; limit: number }> {
    const cleanParams = Object.fromEntries(
      Object.entries(params ?? {}).filter(([, value]) => value !== undefined && value !== null),
    );
    return this.apiClient.get<{ logs: WebhookLog[]; total: number; page: number; limit: number }>(
      `/webhooks/${id}/logs`,
      { params: cleanParams as any },
    );
  }

  /**
   * List events received by an internal test inbox.
   */
  listInboxEvents(
    id: string,
    params?: { page?: number; limit?: number },
  ): Observable<{ events: WebhookInboxEvent[]; total: number; page: number; limit: number }> {
    const cleanParams = Object.fromEntries(
      Object.entries(params ?? {}).filter(([, value]) => value !== undefined && value !== null),
    );
    return this.apiClient.get<{
      events: WebhookInboxEvent[];
      total: number;
      page: number;
      limit: number;
    }>(`/webhooks/${id}/inbox-events`, { params: cleanParams as any });
  }

  /**
   * Force manually retry a failed webhook delivery
   */
  retryLog(id: string, logId: string): Observable<any> {
    return this.apiClient.post<any>(`/webhooks/${id}/logs/${logId}/retry`, {});
  }
}
