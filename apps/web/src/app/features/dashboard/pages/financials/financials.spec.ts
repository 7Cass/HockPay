import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { EnvironmentService } from '../../../../core/services/environment.service';
import { FinancialService } from '../../../../core/services/financial.service';
import { Financials } from './financials';

describe('Financials', () => {
    function createComponent(isLive: boolean) {
        TestBed.configureTestingModule({
            providers: [
                { provide: FinancialService, useValue: { getAccount: vi.fn(), listTransactions: vi.fn() } },
                { provide: EnvironmentService, useValue: { isLive: signal(isLive) } },
            ],
        });

        return TestBed.runInInjectionContext(() => new Financials());
    }

    it('says the LIVE balance is simulated, and that TEST does not mix with it', () => {
        const description = createComponent(true).ledgerDescription();

        expect(description).toContain('LIVE');
        expect(description).toContain('simulado');
        expect(description).toContain('não se mistura');
    });

    it('points at the topbar as where the environment changes, in TEST', () => {
        // A página não mente mais dizendo "o dashboard não mostra LIVE": agora
        // mostra, e diz onde trocar.
        const description = createComponent(false).ledgerDescription();

        expect(description).toContain('TEST');
        expect(description).toContain('barra do topo');
    });
});
