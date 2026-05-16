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

export interface DashboardOverviewResponse {
    period: {
        startDate: string;
        endDate: string;
        previousStartDate: string;
        previousEndDate: string;
    };
    balance: {
        available: number;
        pending: number;
        blocked: number;
        currency: string;
        availableDelta: number | null;
        pendingDelta: number | null;
    };
    performance: {
        grossVolume: number;
        netVolume: number;
        feeVolume: number;
        salesCount: number;
        averageTicket: number;
        grossVolumeDelta: number | null;
        netVolumeDelta: number | null;
        salesCountDelta: number | null;
        averageTicketDelta: number | null;
    };
    conversion: {
        paymentApprovalRate: number;
        paymentAttempts: number;
        approvedPayments: number;
        linkConversionRate: number;
        linksCreated: number;
        linksOpened: number;
        linksPaid: number;
    };
    chart: Array<{
        date: string;
        netVolume: number;
        salesCount: number;
    }>;
    paymentStatusBreakdown: Array<{
        status: string;
        count: number;
        amount: number;
    }>;
    attention: {
        pendingPayments: number;
        failedPayments: number;
        expiredPayments: number;
        refundedPayments: number;
        failedWebhookDeliveries: number;
        pendingWebhookDeliveries: number;
        failedAlertDeliveries: number;
        pendingAlertDeliveries: number;
        expiredLinks: number;
        cancelledLinks: number;
    };
    integrationsHealth: {
        activeWebhooks: number;
        activeAlerts: number;
        failedWebhookDeliveries: number;
        failedAlertDeliveries: number;
        environment: 'TEST' | 'LIVE';
    };
    recentPayments: Array<{
        id: string;
        amount: number;
        netAmount: number;
        currency: string;
        status: string;
        origin: 'api' | 'checkout' | 'payment_link' | 'unknown';
        description?: string;
        payerName?: string;
        payerEmail?: string;
        customerId?: string;
        createdAt: string;
    }>;
}

@Injectable({
    providedIn: 'root'
})
export class DashboardService {
    private readonly apiClient = inject(ApiClientService);

    getOverview(startDate?: string, endDate?: string): Observable<DashboardOverviewResponse> {
        let params: Record<string, string> = {};
        if (startDate) params['startDate'] = startDate;
        if (endDate) params['endDate'] = endDate;

        return this.apiClient.get<DashboardOverviewResponse>('/dashboard/overview', { params });
    }

    getMetrics(startDate?: string, endDate?: string): Observable<DashboardMetricsResponse> {
        // If no dates are provided, the backend defaults to the last 30 days
        let params: Record<string, string> = {};
        if (startDate) params['startDate'] = startDate;
        if (endDate) params['endDate'] = endDate;

        return this.apiClient.get<DashboardMetricsResponse>('/dashboard/metrics', { params });
    }
}
