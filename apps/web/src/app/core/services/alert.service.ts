import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';

export type AlertChannel = 'discord';
export type AlertDeliveryStatus = 'PENDING' | 'DELIVERED' | 'FAILED';

export interface AlertConfig {
  id: string;
  name: string;
  channel: AlertChannel;
  configPreview: {
    webhookUrl: string;
  };
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlertDeliveryLog {
  id: string;
  alertConfigId: string;
  outboxEventId: string;
  paymentId?: string;
  eventType: string;
  channel: AlertChannel;
  status: AlertDeliveryStatus;
  payload: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  attempt: number;
  maxAttempts: number;
  nextRetryAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface CreateAlertInput {
  name: string;
  channel: AlertChannel;
  discord: {
    webhookUrl: string;
  };
  events: string[];
  isActive?: boolean;
}

export interface UpdateAlertInput {
  name?: string;
  discord?: {
    webhookUrl?: string;
  };
  events?: string[];
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  private readonly apiClient = inject(ApiClientService);

  list(): Observable<{ alerts: AlertConfig[] }> {
    return this.apiClient.get<{ alerts: AlertConfig[] }>('/alerts');
  }

  create(data: CreateAlertInput): Observable<{ alert: AlertConfig }> {
    return this.apiClient.post<{ alert: AlertConfig }>('/alerts', data);
  }

  update(id: string, data: UpdateAlertInput): Observable<{ alert: AlertConfig }> {
    return this.apiClient.patch<{ alert: AlertConfig }>(`/alerts/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.apiClient.delete<void>(`/alerts/${id}`);
  }

  test(id: string): Observable<{ success: boolean; alert: AlertConfig; log: AlertDeliveryLog }> {
    return this.apiClient.post<{ success: boolean; alert: AlertConfig; log: AlertDeliveryLog }>(
      `/alerts/${id}/test`,
      {},
    );
  }

  listLogs(
    id: string,
    params?: { page?: number; limit?: number; status?: AlertDeliveryStatus },
  ): Observable<{ logs: AlertDeliveryLog[]; total: number; page: number; limit: number }> {
    return this.apiClient.get<{ logs: AlertDeliveryLog[]; total: number; page: number; limit: number }>(
      `/alerts/${id}/logs`,
      { params: params as any },
    );
  }

  retryLog(id: string, logId: string): Observable<{ success: boolean; log: AlertDeliveryLog }> {
    return this.apiClient.post<{ success: boolean; log: AlertDeliveryLog }>(
      `/alerts/${id}/logs/${logId}/retry`,
      {},
    );
  }
}
