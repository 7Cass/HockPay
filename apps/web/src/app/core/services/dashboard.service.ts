import { Injectable, inject } from '@angular/core';
import { ApiClientService } from './api-client.service';
import { Observable } from 'rxjs';

export interface DailyVolumeItem {
    date: string;
    volume: number;
    count: number;
}

export interface DashboardMetricsResponse {
    currentBalance: {
        available: number;
        pending: number;
        blocked: number;
    };
    processing: {
        totalVolume: number;
        salesCount: number;
        averageTicket: number;
        feeVolume: number;
    };
    chartData: DailyVolumeItem[];
}

@Injectable({
    providedIn: 'root'
})
export class DashboardService {
    private readonly apiClient = inject(ApiClientService);

    getMetrics(startDate?: string, endDate?: string): Observable<DashboardMetricsResponse> {
        // If no dates are provided, the backend defaults to the last 30 days
        let params: Record<string, string> = {};
        if (startDate) params['startDate'] = startDate;
        if (endDate) params['endDate'] = endDate;

        return this.apiClient.get<DashboardMetricsResponse>('/dashboard/metrics', { params });
    }
}
