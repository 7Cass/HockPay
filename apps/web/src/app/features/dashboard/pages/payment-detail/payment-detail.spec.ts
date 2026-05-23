import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { PaymentService, PaymentStatus } from '../../../../core/services/payment.service';
import { RefundService } from '../../../../core/services/refund.service';
import { PaymentDetail } from './payment-detail';

describe('PaymentDetail', () => {
    function createComponent() {
        const timeline = signal<any>({
            payment: {
                id: 'payment-1',
                amount: 5000,
                totalRefunded: 1000,
                status: PaymentStatus.CONFIRMED,
            },
            refunds: [],
            timeline: [],
            transactions: [],
            webhookLogs: [],
        });
        const refundSubject = new Subject<any>();
        const refundService = {
            create: vi.fn(() => refundSubject.asObservable()),
            createIdempotencyKey: vi.fn(() => 'refund-key-1'),
        };
        const paymentService = {
            currentTimeline: timeline,
            loadPaymentTimeline: vi.fn(),
            clearTimelineState: vi.fn(),
            isTimelineLoading: signal(false),
            timelineError: signal(null),
        };

        TestBed.configureTestingModule({
            providers: [
                {
                    provide: ActivatedRoute,
                    useValue: {
                        paramMap: new Subject(),
                    },
                },
                { provide: PaymentService, useValue: paymentService },
                { provide: RefundService, useValue: refundService },
            ],
        });

        return {
            component: TestBed.runInInjectionContext(() => new PaymentDetail()),
            refundService,
            refundSubject,
            paymentService,
        };
    }

    it('guards refund double submit with one idempotency key while the request is pending', () => {
        const { component, refundService } = createComponent();

        component.openRefundDialog(component.paymentService.currentTimeline()!.payment);
        component.refundForm.controls.amount.setValue('20,00');

        component.submitRefund();
        component.submitRefund();

        expect(refundService.createIdempotencyKey).toHaveBeenCalledTimes(1);
        expect(refundService.create).toHaveBeenCalledTimes(1);
        expect(refundService.create).toHaveBeenCalledWith({
            paymentId: 'payment-1',
            amount: 2000,
            reason: undefined,
            idempotencyKey: 'refund-key-1',
        });
    });

    it('rejects refunds above the remaining refundable amount before calling the API', () => {
        const { component, refundService } = createComponent();

        component.openRefundDialog(component.paymentService.currentTimeline()!.payment);
        component.refundForm.controls.amount.setValue('50,00');
        component.refundForm.controls.amount.markAsTouched();

        component.submitRefund();

        expect(refundService.create).not.toHaveBeenCalled();
        expect(component.refundError()).toBe('O valor não pode exceder o restante reembolsável.');
    });
});
