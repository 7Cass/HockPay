import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { PaymentService, PaymentStatus } from './payment.service';

describe('PaymentService', () => {
    it('passes operational list filters to the payments endpoint', () => {
        const apiClient = {
            get: vi.fn(() => of({
                payments: [],
                total: 0,
                page: 2,
                limit: 10,
                totalPages: 1,
            })),
        };

        TestBed.configureTestingModule({
            providers: [{ provide: ApiClientService, useValue: apiClient }],
        });

        const service = TestBed.inject(PaymentService);

        service.loadPayments({
            page: 2,
            limit: 10,
            status: PaymentStatus.CONFIRMED,
            externalId: 'order-123',
            startDate: '2026-05-01',
            endDate: '2026-05-23',
        });

        const params = (apiClient.get.mock.calls[0] as any[])[1].params;
        expect(apiClient.get).toHaveBeenCalledWith('/payments', expect.any(Object));
        expect(params.get('page')).toBe('2');
        expect(params.get('limit')).toBe('10');
        expect(params.get('status')).toBe('CONFIRMED');
        expect(params.get('externalId')).toBe('order-123');
        expect(params.get('startDate')).toBe('2026-05-01');
        expect(params.get('endDate')).toBe('2026-05-23');
        expect(service.page()).toBe(2);
        expect(service.limit()).toBe(10);
    });
});
