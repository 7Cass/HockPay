import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import {
    lucideArrowRight,
    lucideArrowRightLeft,
    lucideCalendar,
    lucideClock,
    lucideRefreshCcw,
    lucideShield,
    lucideWallet,
    lucideXCircle,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmTableImports } from '@spartan-ng/helm/table';
import {
    AccountObject,
    FinancialService,
    ListTransactionsResponse,
    TransactionObject,
    TransactionType,
} from '../../../../core/services/financial.service';

@Component({
    selector: 'app-financials',
    standalone: true,
    imports: [
        CommonModule,
        RouterLink,
        DatePipe,
        CurrencyPipe,
        HlmButtonImports,
        HlmIconImports,
        HlmInputImports,
        HlmSpinnerImports,
        HlmTableImports,
    ],
    providers: [
        provideIcons({
            lucideArrowRight,
            lucideArrowRightLeft,
            lucideCalendar,
            lucideClock,
            lucideRefreshCcw,
            lucideShield,
            lucideWallet,
            lucideXCircle,
        }),
    ],
    templateUrl: './financials.html',
})
export class Financials implements OnInit {
    private readonly financialService = inject(FinancialService);

    readonly account = signal<AccountObject | null>(null);
    readonly transactions = signal<TransactionObject[]>([]);
    readonly meta = signal<ListTransactionsResponse['meta']>({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
    });
    readonly isLoading = signal(true);
    readonly error = signal<string | null>(null);
    readonly typeFilter = signal<TransactionType | 'all'>('all');
    readonly startDate = signal('');
    readonly endDate = signal('');

    readonly transactionTypes: Array<{ value: TransactionType | 'all'; label: string }> = [
        { value: 'all', label: 'Todos os tipos' },
        { value: 'PAYMENT_RECEIVED', label: 'Pagamento recebido' },
        { value: 'PAYMENT_RELEASED', label: 'Saldo liberado' },
        { value: 'REFUND_DEDUCTED', label: 'Estorno debitado' },
        { value: 'NEGATIVE_COMPENSATED', label: 'Compensação negativa' },
        { value: 'WITHDRAWAL_SENT', label: 'Saque enviado' },
        { value: 'WITHDRAWAL_REVERSED', label: 'Saque revertido' },
        { value: 'FEE_CHARGED', label: 'Taxa' },
        { value: 'ADJUSTMENT', label: 'Ajuste' },
    ];

    ngOnInit(): void {
        this.reload();
    }

    reload(page = this.meta().page): void {
        this.isLoading.set(true);
        this.error.set(null);
        const selectedType = this.typeFilter();

        this.financialService.getAccount().subscribe({
            next: (response) => this.account.set(response.account),
            error: (err) => {
                console.error('Failed to load account:', err);
                this.error.set(err.message || 'Erro ao carregar saldo');
            },
        });

        this.financialService
            .listTransactions({
                page,
                limit: this.meta().limit,
                type: selectedType === 'all' ? undefined : selectedType,
                startDate: this.startDate() || undefined,
                endDate: this.endDate() || undefined,
            })
            .subscribe({
                next: (response) => {
                    this.transactions.set(response.data);
                    this.meta.set(response.meta);
                    this.isLoading.set(false);
                },
                error: (err) => {
                    console.error('Failed to load transactions:', err);
                    this.error.set(err.message || 'Erro ao carregar extrato');
                    this.isLoading.set(false);
                },
            });
    }

    applyFilters(): void {
        this.reload(1);
    }

    clearFilters(): void {
        this.typeFilter.set('all');
        this.startDate.set('');
        this.endDate.set('');
        this.reload(1);
    }

    changePage(delta: number): void {
        const nextPage = this.meta().page + delta;
        if (nextPage < 1 || nextPage > this.meta().totalPages) return;
        this.reload(nextPage);
    }

    setType(value: string): void {
        this.typeFilter.set(value as TransactionType | 'all');
    }

    setStartDate(value: string): void {
        this.startDate.set(value);
    }

    setEndDate(value: string): void {
        this.endDate.set(value);
    }

    formatTransactionType(type: string): string {
        const match = this.transactionTypes.find((item) => item.value === type);
        return match?.label || type;
    }

    shortId(value?: string | null): string {
        if (!value) return '-';
        return value.length <= 12 ? value : `${value.slice(0, 8)}...`;
    }

    isPaymentReference(transaction: TransactionObject): boolean {
        return (
            (transaction.referenceType === 'PAYMENT' || transaction.referenceType === 'Payment') &&
            !!transaction.referenceId
        );
    }

    getNetAmountClasses(transaction: TransactionObject): string {
        if (transaction.netAmount < 0) return 'text-red-600';
        if (transaction.netAmount > 0) return 'text-emerald-600';
        return 'text-zinc-700';
    }
}
