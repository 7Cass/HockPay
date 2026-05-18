import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideArrowLeft,
    lucideBadgeCheck,
    lucideCheckCircle2,
    lucideCircleAlert,
    lucideClock,
    lucideRefreshCcw,
    lucideSend,
    lucideWallet,
    lucideXCircle,
} from '@ng-icons/lucide';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { finalize } from 'rxjs';
import { BankAccount, BankAccountService } from '../../../../core/services/bank-account.service';
import { AccountObject, FinancialService } from '../../../../core/services/financial.service';
import { Withdrawal, WithdrawalService, WithdrawalStatus } from '../../../../core/services/withdrawal.service';

@Component({
    selector: 'app-withdrawal-detail',
    standalone: true,
    imports: [
        CommonModule,
        RouterLink,
        CurrencyPipe,
        DatePipe,
        NgIconComponent,
        ...HlmBadgeImports,
        ...HlmButtonImports,
        HlmIconImports,
        ...HlmSpinnerImports,
    ],
    providers: [
        provideIcons({
            lucideArrowLeft,
            lucideBadgeCheck,
            lucideCheckCircle2,
            lucideCircleAlert,
            lucideClock,
            lucideRefreshCcw,
            lucideSend,
            lucideWallet,
            lucideXCircle,
        }),
    ],
    templateUrl: './withdrawal-detail.html',
})
export class WithdrawalDetail implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly withdrawalService = inject(WithdrawalService);
    private readonly bankAccountService = inject(BankAccountService);
    private readonly financialService = inject(FinancialService);

    readonly withdrawal = signal<Withdrawal | null>(null);
    readonly bankAccounts = signal<BankAccount[]>([]);
    readonly account = signal<AccountObject | null>(null);
    readonly isLoading = signal(true);
    readonly actionLoading = signal<'complete' | 'fail' | null>(null);
    readonly error = signal<string | null>(null);
    readonly actionError = signal<string | null>(null);

    readonly bankAccount = computed(() => {
        const withdrawal = this.withdrawal();
        if (!withdrawal) return null;
        return this.bankAccounts().find((account) => account.id === withdrawal.bankAccountId) ?? null;
    });

    readonly canSimulate = computed(() => {
        const status = this.withdrawal()?.status;
        return status === 'PENDING' || status === 'PROCESSING';
    });

    ngOnInit(): void {
        this.reload();
    }

    reload(): void {
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) {
            this.error.set('Saque não informado.');
            this.isLoading.set(false);
            return;
        }

        this.isLoading.set(true);
        this.error.set(null);
        this.actionError.set(null);
        this.loadBankAccounts();
        this.loadAccount();
        this.withdrawalService
            .get(id)
            .pipe(finalize(() => this.isLoading.set(false)))
            .subscribe({
                next: (response) => this.withdrawal.set(response.withdrawal),
                error: (err) => this.error.set(this.extractErrorMessage(err, 'Erro ao carregar saque')),
            });
    }

    complete(): void {
        const withdrawal = this.withdrawal();
        if (!withdrawal || !this.canSimulate() || this.actionLoading()) return;

        this.actionLoading.set('complete');
        this.actionError.set(null);
        this.withdrawalService
            .completeDev(withdrawal.id)
            .pipe(finalize(() => this.actionLoading.set(null)))
            .subscribe({
                next: (response) => {
                    this.withdrawal.set(response.withdrawal);
                    this.loadAccount();
                },
                error: (err) => this.actionError.set(this.extractErrorMessage(err, 'Erro ao completar saque')),
            });
    }

    fail(): void {
        const withdrawal = this.withdrawal();
        if (!withdrawal || !this.canSimulate() || this.actionLoading()) return;

        this.actionLoading.set('fail');
        this.actionError.set(null);
        this.withdrawalService
            .failDev(withdrawal.id)
            .pipe(finalize(() => this.actionLoading.set(null)))
            .subscribe({
                next: (response) => {
                    this.withdrawal.set(response.withdrawal);
                    this.loadAccount();
                },
                error: (err) => this.actionError.set(this.extractErrorMessage(err, 'Erro ao falhar saque')),
            });
    }

    statusLabel(status: WithdrawalStatus): string {
        const labels: Record<WithdrawalStatus, string> = {
            PENDING: 'Pendente',
            PROCESSING: 'Processando',
            COMPLETED: 'Concluído',
            FAILED: 'Falhou',
        };
        return labels[status];
    }

    statusIcon(status: WithdrawalStatus): string {
        const icons: Record<WithdrawalStatus, string> = {
            PENDING: 'lucideClock',
            PROCESSING: 'lucideSend',
            COMPLETED: 'lucideCheckCircle2',
            FAILED: 'lucideXCircle',
        };
        return icons[status];
    }

    statusClasses(status: WithdrawalStatus): string {
        const classes: Record<WithdrawalStatus, string> = {
            PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
            PROCESSING: 'border-blue-200 bg-blue-50 text-blue-700',
            COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
            FAILED: 'border-red-200 bg-red-50 text-red-700',
        };
        return classes[status];
    }

    shortId(value?: string | null): string {
        if (!value) return '-';
        return value.length <= 16 ? value : `${value.slice(0, 12)}...`;
    }

    maskDocument(value?: string | null): string {
        const clean = String(value ?? '').replace(/\D/g, '');
        if (clean.length === 11) {
            return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
        }
        if (clean.length === 14) {
            return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`;
        }
        return value || '-';
    }

    private loadBankAccounts(): void {
        this.bankAccountService.list().subscribe({
            next: (accounts) => this.bankAccounts.set(accounts),
            error: () => this.bankAccounts.set([]),
        });
    }

    private loadAccount(): void {
        this.financialService.getAccount().subscribe({
            next: (response) => this.account.set(response.account),
            error: () => this.account.set(null),
        });
    }

    private extractErrorMessage(err: unknown, fallback: string): string {
        const error = err as {
            message?: string;
            error?: { message?: string; error?: { message?: string } };
        };

        return error?.error?.error?.message || error?.error?.message || error?.message || fallback;
    }
}
