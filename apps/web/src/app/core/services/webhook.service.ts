import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';

/**
 * Webhook Config Business Entity
 */
export interface WebhookConfig {
    id: string;
    url: string;
    prefix: string;
    events: string[];
    isActive: boolean;
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
export interface WebhookLog {
    id: string;
    configId: string;
    paymentId?: string;
    eventType: string;
    payload: any;
    requestHeaders?: any;
    responseStatus?: number;
    responseBody?: string;
    attempt: number;
    maxAttempts: number;
    nextRetryAt?: string;
    deliveredAt?: string;
    createdAt: string;
}

@Injectable({
    providedIn: 'root'
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
     * Update an existing webhook
     */
    update(id: string, data: { url?: string; events?: string[]; isActive?: boolean }): Observable<{ webhook: WebhookConfig }> {
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
    listLogs(id: string, params?: { page?: number; limit?: number; status?: 'delivered' | 'failed' | 'pending' }): Observable<{ logs: WebhookLog[]; total: number; page: number; limit: number }> {
        return this.apiClient.get<{ logs: WebhookLog[]; total: number; page: number; limit: number }>(`/webhooks/${id}/logs`, { params: params as any });
    }

    /**
     * Force manually retry a failed webhook delivery
     */
    retryLog(id: string, logId: string): Observable<any> {
        return this.apiClient.post<any>(`/webhooks/${id}/logs/${logId}/retry`, {});
    }
}
