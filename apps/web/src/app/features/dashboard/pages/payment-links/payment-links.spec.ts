import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { PaymentLinkRecord, PaymentLinkService } from '../../../../core/services/payment-link.service';
import { PaymentLinks } from './payment-links';

describe('PaymentLinks', () => {
    const link = {
        id: 'link-1',
        status: 'ACTIVE',
        checkoutUrl: 'https://checkout.test/link',
        title: 'Pedido 1',
        description: null,
        amount: 1000,
        failedPaymentCount: 0,
    } as PaymentLinkRecord;

    function createComponent() {
        const service = {
            load: vi.fn(),
            cancel: vi.fn(() => of({ paymentLink: { ...link, status: 'CANCELLED' } })),
            stats: signal(null),
            links: signal([]),
            total: signal(0),
            page: signal(1),
            limit: signal(20),
            totalPages: signal(1),
            isLoading: signal(false),
            error: signal(null),
        };

        const router = { navigate: vi.fn() };

        TestBed.configureTestingModule({
            providers: [
                { provide: PaymentLinkService, useValue: service },
                { provide: Router, useValue: router },
                { provide: ActivatedRoute, useValue: { queryParamMap: of(new Map()) } },
            ],
        });

        return {
            component: TestBed.runInInjectionContext(() => new PaymentLinks()),
            service,
            router,
        };
    }

    it('does not call the cancel API before the confirmation dialog is confirmed', () => {
        const { component, service } = createComponent();

        component.cancel(link);

        expect(component.cancelDialogState()).toBe('open');
        expect(component.linkToCancel()).toBe(link);
        expect(service.cancel).not.toHaveBeenCalled();
    });

    it('calls the cancel API after confirmation', () => {
        const { component, service } = createComponent();

        component.cancel(link);
        component.confirmCancel();

        expect(service.cancel).toHaveBeenCalledWith('link-1');
    });

    it('resets pagination when the payment-link filter changes', () => {
        const { component, router } = createComponent();
        component.page.set(3);

        component.selectFilter('paid');

        expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
            queryParams: expect.objectContaining({
                filter: 'paid',
                page: null,
            }),
        }));
    });
});
