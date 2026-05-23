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
    lucideCopy,
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
import { BankAccount } from '../../../../core/services/bank-account.service';
import { AccountObject, FinancialService } from '../../../../core/services/financial.service';
import { DialogImports } from '../../../../shared/components/dialog/dialog.component';
import {
    Withdrawal,
    WithdrawalService,
    WithdrawalStatus,
    WithdrawalTimelineEvent,
    WithdrawalTransaction,
} from '../../../../core/services/withdrawal.service';

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
        ...DialogImports,
    ],
    providers: [
        provideIcons({
            lucideArrowLeft,
            lucideBadgeCheck,
            lucideCheckCircle2,
            lucideCircleAlert,
            lucideClock,
            lucideCopy,
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
    private readonly financialService = inject(FinancialService);

    readonly withdrawal = signal<Withdrawal | null>(null);
    readonly bankAccount = signal<BankAccount | null>(null);
    readonly transactions = signal<WithdrawalTransaction[]>([]);
    readonly timeline = signal<WithdrawalTimelineEvent[]>([]);
    readonly account = signal<AccountObject | null>(null);
    readonly isLoading = signal(true);
    readonly actionLoading = signal<'complete' | 'fail' | null>(null);
    readonly confirmDialogState = signal<'open' | 'closed'>('closed');
    readonly pendingDevAction = signal<'complete' | 'fail' | null>(null);
    readonly error = signal<string | null>(null);
    readonly actionError = signal<string | null>(null);

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
        this.loadAccount();
        this.withdrawalService
            .get(id)
            .pipe(finalize(() => this.isLoading.set(false)))
            .subscribe({
                next: (response) => {
                    this.withdrawal.set(response.withdrawal);
                    this.bankAccount.set(response.bankAccount ?? null);
                    this.transactions.set(response.transactions ?? []);
                    this.timeline.set(response.timeline ?? []);
                },
                error: (err) => this.error.set(this.extractErrorMessage(err, 'Erro ao carregar saque')),
            });
    }

    complete(): void {
        const withdrawal = this.withdrawal();
        if (!withdrawal || !this.canSimulate() || this.actionLoading()) return;

        this.actionError.set(null);
        this.pendingDevAction.set('complete');
        this.confirmDialogState.set('open');
    }

    fail(): void {
        const withdrawal = this.withdrawal();
        if (!withdrawal || !this.canSimulate() || this.actionLoading()) return;

        this.actionError.set(null);
        this.pendingDevAction.set('fail');
        this.confirmDialogState.set('open');
    }

    closeConfirmDialog(): void {
        if (this.actionLoading()) return;
        this.confirmDialogState.set('closed');
        this.pendingDevAction.set(null);
    }

    confirmDevAction(): void {
        const withdrawal = this.withdrawal();
        const action = this.pendingDevAction();
        if (!withdrawal || !action || !this.canSimulate() || this.actionLoading()) return;

        this.actionLoading.set(action);
        this.actionError.set(null);
        const request = action === 'complete'
            ? this.withdrawalService.completeDev(withdrawal.id)
            : this.withdrawalService.failDev(withdrawal.id);

        request
            .pipe(finalize(() => this.actionLoading.set(null)))
            .subscribe({
                next: (response) => {
                    this.confirmDialogState.set('closed');
                    this.pendingDevAction.set(null);
                    this.withdrawal.set(response.withdrawal);
                    this.loadAccount();
                    this.reload();
                },
                error: (err) => {
                    const fallback = action === 'complete' ? 'Erro ao completar saque' : 'Erro ao falhar saque';
                    this.actionError.set(this.extractErrorMessage(err, fallback));
                },
            });
    }

    confirmActionTitle(): string {
        return this.pendingDevAction() === 'complete' ? 'Completar saque TEST' : 'Falhar saque TEST';
    }

    confirmActionDescription(): string {
        if (this.pendingDevAction() === 'complete') {
            return 'Esta ação marca o saque como concluído no ambiente TEST.';
        }
        return 'Esta ação marca o saque como falho no ambiente TEST e devolve o saldo disponível.';
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

    copy(value?: string | null): void {
        if (!value) return;
        void navigator.clipboard?.writeText(value);
    }

    transactionTypeLabel(type: string): string {
        const labels: Record<string, string> = {
            WITHDRAWAL_RESERVED: 'Saldo reservado',
            WITHDRAWAL_SENT: 'Saque enviado',
            WITHDRAWAL_REVERSED: 'Saldo devolvido',
        };
        return labels[type] ?? type;
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
