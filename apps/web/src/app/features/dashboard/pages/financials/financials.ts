import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideArrowRightLeft, lucideRefreshCcw } from '@ng-icons/lucide';
import {
    AccountObject,
    FinancialService,
    ListTransactionsResponse,
    TransactionObject,
    TransactionType,
} from '../../../../core/services/financial.service';
import { PageHeader, PageState, Pagination } from '../../../../shared/ui';

@Component({
    selector: 'app-financials',
    standalone: true,
    imports: [CurrencyPipe, DatePipe, NgIcon, RouterLink, PageHeader, PageState, Pagination],
    providers: [provideIcons({ lucideArrowRight, lucideArrowRightLeft, lucideRefreshCcw })],
    templateUrl: './financials.html',
    styleUrl: './financials.css',
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

    /** Datas em `yyyy-MM-dd`, como o input nativo e a API já falam. */
    readonly startDate = signal('');
    readonly endDate = signal('');

    readonly currency = computed(() => this.account()?.currency || 'BRL');

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
            error: (err) => this.error.set(err.message || 'Erro ao carregar saldo'),
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

    hasActiveFilters(): boolean {
        return Boolean(this.typeFilter() !== 'all' || this.startDate() || this.endDate());
    }

    goToPage(page: number): void {
        this.reload(page);
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
        if (!value) return '—';
        return value.length <= 12 ? value : `${value.slice(0, 8)}…`;
    }

    isPaymentReference(transaction: TransactionObject): boolean {
        return (
            (transaction.referenceType === 'PAYMENT' || transaction.referenceType === 'Payment') &&
            !!transaction.referenceId
        );
    }

    /** No extrato o sinal é a informação — é o único lugar onde valor ganha cor. */
    amountSign(value: number): 'pos' | 'neg' | null {
        if (value > 0) return 'pos';
        if (value < 0) return 'neg';
        return null;
    }
}
