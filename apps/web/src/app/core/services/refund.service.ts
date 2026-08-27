import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { createIdempotencyKey as newIdempotencyKey } from '../http/idempotency-key';
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
        return newIdempotencyKey('refund');
    }
}
