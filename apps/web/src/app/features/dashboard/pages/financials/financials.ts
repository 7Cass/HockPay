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
import { HlmDatePickerImports } from '@spartan-ng/helm/date-picker';
import { HlmIconImports } from '@spartan-ng/helm/icon';
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
        HlmDatePickerImports,
        HlmIconImports,
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
    readonly dateRange = signal<[Date, Date] | undefined>(undefined);

    readonly formatDateRange = (dates: [Date | undefined, Date | undefined]): string => {
        const [start, end] = dates;
        if (start && end) return `${this.formatDisplayDate(start)} - ${this.formatDisplayDate(end)}`;
        if (start) return `A partir de ${this.formatDisplayDate(start)}`;
        if (end) return `Até ${this.formatDisplayDate(end)}`;
        return '';
    };

    readonly transactionTypes: Array<{ value: TransactionType | 'all'; label: string }> = [
        { value: 'all', label: 'Todos os tipos' },
        { value: 'PAYMENT_RECEIVED', label: 'Pagamento recebido' },
        { value: 'PAYMENT_RELEASED', label: 'Saldo liberado' },
        { value: 'REFUND_DEDUCTED', label: 'Estorno debitado' },
        { value: 'NEGATIVE_COMPENSATED', label: 'Compensação negativa' },
        { value: 'WITHDRAWAL_RESERVED', label: 'Saque reservado' },
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
                startDate: this.formatApiDate(this.dateRange()?.[0]),
                endDate: this.formatApiDate(this.dateRange()?.[1]),
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
        this.dateRange.set(undefined);
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

    setDateRange(value: [Date, Date] | null): void {
        this.dateRange.set(value ?? undefined);
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

    private formatApiDate(date?: Date): string | undefined {
        if (!date) return undefined;
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private formatDisplayDate(date: Date): string {
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(date);
    }
}
