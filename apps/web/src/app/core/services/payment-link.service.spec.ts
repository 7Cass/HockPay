import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { PaymentLinkService } from './payment-link.service';

describe('PaymentLinkService', () => {
    // A API recusa POST /payment-links sem Idempotency-Key com 400. O dashboard
    // ja quebrou uma vez por isso; o teste existe para nao quebrar de novo.
    it('posts payment links with an Idempotency-Key header', () => {
        const apiClient = {
            post: vi.fn(() => of({ paymentLink: {} })),
        };

        TestBed.configureTestingModule({
            providers: [{ provide: ApiClientService, useValue: apiClient }],
        });

        const service = TestBed.inject(PaymentLinkService);

        service.create({ amount: 2500, title: 'Consultoria' }).subscribe();

        expect(apiClient.post).toHaveBeenCalledWith(
            '/payment-links',
            { amount: 2500, title: 'Consultoria' },
            expect.objectContaining({
                headers: expect.objectContaining({ get: expect.any(Function) }),
            }),
        );

        const options = (apiClient.post.mock.calls[0] as any[])[2];
        expect(options.headers.get('Idempotency-Key')).toBeTruthy();
    });
});
