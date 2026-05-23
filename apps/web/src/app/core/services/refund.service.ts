import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import type { PaymentObject, RefundObject } from './payment.service';

export interface CreateRefundInput {
    paymentId: string;
    amount: number;
    reason?: string;
    idempotencyKey: string;
}

export interface CreateRefundResponse {
    refund: RefundObject;
    payment: PaymentObject;
}

@Injectable({
    providedIn: 'root',
})
export class RefundService {
    private readonly apiClient = inject(ApiClientService);

    create(input: CreateRefundInput): Observable<CreateRefundResponse> {
        const headers = new HttpHeaders({
            'Idempotency-Key': input.idempotencyKey,
        });

        return this.apiClient.post<CreateRefundResponse>(
            '/refunds',
            {
                paymentId: input.paymentId,
                amount: input.amount,
                reason: input.reason,
            },
            { headers },
        );
    }

    createIdempotencyKey(): string {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }

        return `refund-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
}
