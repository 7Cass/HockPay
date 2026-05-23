import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { RefundService } from './refund.service';

describe('RefundService', () => {
    it('posts refunds with an Idempotency-Key header', () => {
        const apiClient = {
            post: vi.fn(() => of({ refund: {}, payment: {} })),
        };

        TestBed.configureTestingModule({
            providers: [{ provide: ApiClientService, useValue: apiClient }],
        });

        const service = TestBed.inject(RefundService);

        service.create({
            paymentId: 'payment-1',
            amount: 1200,
            reason: 'Pedido cancelado',
            idempotencyKey: 'refund-key-1',
        }).subscribe();

        expect(apiClient.post).toHaveBeenCalledWith(
            '/refunds',
            {
                paymentId: 'payment-1',
                amount: 1200,
                reason: 'Pedido cancelado',
            },
            expect.objectContaining({
                headers: expect.objectContaining({
                    get: expect.any(Function),
                }),
            }),
        );

        const options = (apiClient.post.mock.calls[0] as any[])[2];
        expect(options.headers.get('Idempotency-Key')).toBe('refund-key-1');
    });
});
