import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';
import { BankAccountService } from '../../../../core/services/bank-account.service';
import { EnvironmentService } from '../../../../core/services/environment.service';
import { FinancialService } from '../../../../core/services/financial.service';
import { WithdrawalService } from '../../../../core/services/withdrawal.service';
import { Withdrawals } from './withdrawals';

describe('Withdrawals', () => {
    async function render(isLive: boolean) {
        TestBed.configureTestingModule({
            imports: [Withdrawals],
            providers: [
                {
                    provide: WithdrawalService,
                    useValue: {
                        list: vi.fn(() =>
                            of({
                                withdrawals: [],
                                summary: { pendingOrProcessingAmount: 0 },
                                meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
                            }),
                        ),
                    },
                },
                { provide: BankAccountService, useValue: { list: vi.fn(() => of([])) } },
                {
                    provide: FinancialService,
                    useValue: {
                        getAccount: vi.fn(() =>
                            of({
                                account: {
                                    available: 0,
                                    pending: 0,
                                    blocked: 0,
                                    currency: 'BRL',
                                },
                            }),
                        ),
                    },
                },
                { provide: AuthService, useValue: { currentUser: signal(null) } },
                {
                    provide: EnvironmentService,
                    useValue: { isLive: signal(isLive) },
                },
                { provide: Router, useValue: { navigate: vi.fn() } },
            ],
        });

        const fixture = TestBed.createComponent(Withdrawals);
        const component = fixture.componentInstance;
        component.withdrawalSheetState.set('open');
        await fixture.whenStable();

        return { el: fixture.nativeElement as HTMLElement };
    }

    it('says LIVE withdrawal is simulated, inside the form itself', async () => {
        const { el } = await render(true);

        // No próprio formulário, e não só no rodapé da página de saldo: é aqui
        // que alguém está prestes a sacar.
        const note = el.querySelector('.live-sim-note');
        expect(note?.textContent).toContain('simulado');
        expect(note?.textContent).toContain('nenhum dinheiro real se move');
    });

    it('does not clutter the TEST form with the LIVE warning', async () => {
        const { el } = await render(false);

        expect(el.querySelector('.live-sim-note')).toBeNull();
    });
});
