import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { FinancialService } from '../../../../core/services/financial.service';
import { Withdrawal, WithdrawalService } from '../../../../core/services/withdrawal.service';
import { WithdrawalDetail } from './withdrawal-detail';

describe('WithdrawalDetail', () => {
    const withdrawal: Withdrawal = {
        id: 'withdrawal-1',
        accountId: 'account-1',
        bankAccountId: 'bank-account-1',
        amount: 1000,
        fee: 100,
        netAmount: 900,
        status: 'PENDING',
        processingAttempts: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    };

    let withdrawalService: {
        get: ReturnType<typeof vi.fn>;
        completeDev: ReturnType<typeof vi.fn>;
        failDev: ReturnType<typeof vi.fn>;
    };

    function createComponent(): WithdrawalDetail {
        withdrawalService = {
            get: vi.fn(() => of({ withdrawal })),
            completeDev: vi.fn(() => of({ withdrawal })),
            failDev: vi.fn(() => of({ withdrawal })),
        };

        TestBed.configureTestingModule({
            providers: [
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: {
                            paramMap: {
                                get: () => 'withdrawal-1',
                            },
                        },
                    },
                },
                { provide: WithdrawalService, useValue: withdrawalService },
                {
                    provide: FinancialService,
                    useValue: {
                        getAccount: vi.fn(() => of({ account: null })),
                    },
                },
            ],
        });

        return TestBed.runInInjectionContext(() => new WithdrawalDetail());
    }

    it('opens a custom confirmation before completing a TEST withdrawal', () => {
        const component = createComponent();
        component.withdrawal.set(withdrawal);
        const confirmSpy = vi.spyOn(window, 'confirm');

        component.complete();

        expect(confirmSpy).not.toHaveBeenCalled();
        expect(component.confirmDialogState()).toBe('open');
        expect(component.pendingDevAction()).toBe('complete');
        expect(component.actionLoading()).toBeNull();
        expect(withdrawalService.completeDev).not.toHaveBeenCalled();
    });

    it('opens a custom confirmation before failing a TEST withdrawal', () => {
        const component = createComponent();
        component.withdrawal.set(withdrawal);
        const confirmSpy = vi.spyOn(window, 'confirm');

        component.fail();

        expect(confirmSpy).not.toHaveBeenCalled();
        expect(component.confirmDialogState()).toBe('open');
        expect(component.pendingDevAction()).toBe('fail');
        expect(component.actionLoading()).toBeNull();
        expect(withdrawalService.failDev).not.toHaveBeenCalled();
    });

    it('runs the selected action only after confirming the dialog', () => {
        const component = createComponent();
        component.withdrawal.set(withdrawal);

        component.complete();
        component.confirmDevAction();

        expect(withdrawalService.completeDev).toHaveBeenCalledWith('withdrawal-1');
    });
});
