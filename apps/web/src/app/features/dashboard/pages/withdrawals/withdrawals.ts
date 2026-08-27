import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
    lucideBanknoteArrowDown,
    lucideBuilding2,
    lucideCheck,
    lucideCircleAlert,
    lucideCircleCheck,
    lucideCopy,
    lucidePlus,
    lucideRefreshCcw,
    lucideSearch,
    lucideSend,
    lucideTrash2,
} from '@ng-icons/lucide';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { BankAccount, BankAccountService } from '../../../../core/services/bank-account.service';
import { AccountObject, FinancialService } from '../../../../core/services/financial.service';
import {
    ListWithdrawalsResponse,
    Withdrawal,
    WithdrawalService,
    WithdrawalStatus,
    WithdrawalSummary,
} from '../../../../core/services/withdrawal.service';
import { PageHeader, PageState, Pagination, Sheet, StatusChip } from '../../../../shared/ui';

const WITHDRAWAL_FEE_CENTS = 199;
const MIN_WITHDRAWAL_CENTS = 1000;
const MAX_WITHDRAWAL_CENTS = 500000;
const EMPTY_SUMMARY: WithdrawalSummary = {
    totalCount: 0,
    totalAmount: 0,
    totalFee: 0,
    totalNetAmount: 0,
    pendingCount: 0,
    processingCount: 0,
    completedCount: 0,
    failedCount: 0,
    pendingOrProcessingAmount: 0,
    completedNetAmount: 0,
    failedAmount: 0,
};

function parseBrlToCents(value: string | number | null | undefined): number {
    if (typeof value === 'number') return Math.round(value * 100);

    const raw = String(value ?? '').trim();
    if (!raw) return 0;

    const normalized = raw
        .replace(/[^\d,.-]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
    const amount = Number(normalized);

    return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

@Component({
    selector: 'app-withdrawals',
    standalone: true,
    imports: [
        CurrencyPipe,
        DatePipe,
        NgIcon,
        NgxMaskDirective,
        PageHeader,
        PageState,
        Pagination,
        Sheet,
        StatusChip,
    ],
    providers: [
        provideIcons({
            lucideBanknoteArrowDown,
            lucideBuilding2,
            lucideCheck,
            lucideCircleAlert,
            lucideCircleCheck,
            lucideCopy,
            lucidePlus,
            lucideRefreshCcw,
            lucideSearch,
            lucideSend,
            lucideTrash2,
        }),
        provideNgxMask(),
    ],
    templateUrl: './withdrawals.html',
    styleUrl: './withdrawals.css',
})
export class Withdrawals implements OnInit {
    private readonly withdrawalService = inject(WithdrawalService);
    private readonly bankAccountService = inject(BankAccountService);
    private readonly financialService = inject(FinancialService);
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);

    readonly account = signal<AccountObject | null>(null);
    readonly withdrawals = signal<Withdrawal[]>([]);
    readonly bankAccounts = signal<BankAccount[]>([]);
    readonly meta = signal<ListWithdrawalsResponse>({
        withdrawals: [],
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
        summary: EMPTY_SUMMARY,
    });
    readonly summary = signal<WithdrawalSummary>(EMPTY_SUMMARY);
    readonly isLoading = signal(true);
    readonly isCreatingWithdrawal = signal(false);
    readonly isCreatingBankAccount = signal(false);
    readonly deletingBankAccountId = signal<string | null>(null);
    readonly error = signal<string | null>(null);
    readonly withdrawalFormError = signal<string | null>(null);
    readonly bankAccountError = signal<string | null>(null);
    readonly createdWithdrawalId = signal<string | null>(null);
    readonly copiedValue = signal<string | null>(null);
    readonly settingDefaultBankAccountId = signal<string | null>(null);
    readonly bankAccountToDelete = signal<BankAccount | null>(null);
    readonly deleteBankAccountDialogState = signal<'open' | 'closed'>('closed');
    readonly withdrawalSheetState = signal<'open' | 'closed'>('closed');
    readonly accountsSheetState = signal<'open' | 'closed'>('closed');
    readonly statusFilter = signal<WithdrawalStatus | 'all'>('all');
    readonly bankAccountFilter = signal('all');
    readonly qFilter = signal('');
    readonly startDate = signal('');
    readonly endDate = signal('');
    readonly selectedBankAccountId = signal('');
    readonly withdrawalAmountInput = signal('');
    readonly isConfirmingWithdrawal = signal(false);

    readonly feeCents = WITHDRAWAL_FEE_CENTS;
    readonly minWithdrawalCents = MIN_WITHDRAWAL_CENTS;
    readonly maxWithdrawalCents = MAX_WITHDRAWAL_CENTS;
    readonly statuses: Array<{ value: WithdrawalStatus | 'all'; label: string }> = [
        { value: 'all', label: 'Todos os status' },
        { value: 'PENDING', label: 'Pendente' },
        { value: 'PROCESSING', label: 'Processando' },
        { value: 'COMPLETED', label: 'Concluído' },
        { value: 'FAILED', label: 'Falhou' },
    ];

    readonly verifiedBankAccounts = computed(() => this.bankAccounts().filter((account) => account.isVerified));
    readonly selectedBankAccount = computed(() => {
        const selectedId = this.selectedBankAccountId();
        return this.bankAccounts().find((account) => account.id === selectedId) ?? null;
    });
    readonly withdrawalAmountCents = computed(() => parseBrlToCents(this.withdrawalAmountInput()));
    readonly withdrawalNetCents = computed(() => Math.max(this.withdrawalAmountCents() - this.feeCents, 0));
    readonly pendingOrProcessingTotal = computed(() => this.summary().pendingOrProcessingAmount);
    readonly completedTotal = computed(() => this.summary().completedNetAmount);
    readonly disabledCreateReason = computed(() => this.withdrawalValidationMessage());
    readonly canCreateWithdrawal = computed(() => {
        const amount = this.withdrawalAmountCents();
        return (
            !!this.selectedBankAccount()?.isVerified &&
            amount >= this.minWithdrawalCents &&
            amount <= this.maxWithdrawalCents &&
            amount <= (this.account()?.available ?? 0) &&
            !this.isCreatingWithdrawal()
        );
    });
    readonly merchantPixKeyType = computed(() => this.authService.currentUser()?.documentType ?? 'CPF');
    readonly merchantDocument = computed(() => {
        const user = this.authService.currentUser();
        return this.cleanDocument(user?.document || user?.formattedDocument);
    });
    readonly merchantName = computed(() => this.authService.currentUser()?.name ?? '');

    ngOnInit(): void {
        this.reload();
    }

    reload(page = this.meta().page): void {
        this.isLoading.set(true);
        this.error.set(null);
        this.loadAccount();
        this.loadBankAccounts();
        this.loadWithdrawals(page);
    }

    loadAccount(): void {
        this.financialService.getAccount().subscribe({
            next: (response) => this.account.set(response.account),
            error: (err) => this.error.set(this.extractErrorMessage(err, 'Erro ao carregar saldo')),
        });
    }

    loadBankAccounts(): void {
        this.bankAccountService.list().subscribe({
            next: (accounts) => {
                this.bankAccounts.set(accounts);
                const selected = this.selectedBankAccountId();
                if (!selected || !accounts.some((account) => account.id === selected)) {
                    this.selectedBankAccountId.set(accounts.find((account) => account.isVerified)?.id ?? '');
                }
            },
            error: (err) => this.error.set(this.extractErrorMessage(err, 'Erro ao carregar contas Pix')),
        });
    }

    loadWithdrawals(page = 1): void {
        const selectedStatus = this.statusFilter();
        const selectedBankAccountId = this.bankAccountFilter();

        this.withdrawalService
            .list({
                page,
                limit: this.meta().limit,
                status: selectedStatus === 'all' ? undefined : selectedStatus,
                bankAccountId: selectedBankAccountId === 'all' ? undefined : selectedBankAccountId,
                startDate: this.startDate() || undefined,
                endDate: this.endDate() || undefined,
                q: this.qFilter().trim() || undefined,
            })
            .pipe(finalize(() => this.isLoading.set(false)))
            .subscribe({
                next: (response) => {
                    this.withdrawals.set(response.withdrawals);
                    this.meta.set(response);
                    this.summary.set(response.summary ?? EMPTY_SUMMARY);
                },
                error: (err) => this.error.set(this.extractErrorMessage(err, 'Erro ao carregar saques')),
            });
    }

    openWithdrawalSheet(): void {
        this.withdrawalFormError.set(null);
        this.createdWithdrawalId.set(null);
        this.isConfirmingWithdrawal.set(false);
        this.withdrawalAmountInput.set('');
        this.selectedBankAccountId.set(this.verifiedBankAccounts()[0]?.id ?? '');
        this.withdrawalSheetState.set('open');
    }

    closeWithdrawalSheet(): void {
        if (this.isCreatingWithdrawal()) return;
        this.withdrawalSheetState.set('closed');
    }

    /** Também chega por Escape ou clique no fundo — o rascunho some junto. */
    onWithdrawalSheetClosed(): void {
        this.withdrawalSheetState.set('closed');
        this.withdrawalFormError.set(null);
        this.withdrawalAmountInput.set('');
        this.isConfirmingWithdrawal.set(false);
    }

    openAccountsSheet(): void {
        this.bankAccountError.set(null);
        this.accountsSheetState.set('open');
    }

    closeAccountsSheet(): void {
        this.accountsSheetState.set('closed');
    }

    setStatus(value: string): void {
        this.statusFilter.set(value as WithdrawalStatus | 'all');
    }

    setBankAccountFilter(value: string): void {
        this.bankAccountFilter.set(value);
    }

    setSearch(value: string): void {
        this.qFilter.set(value);
    }

    setStartDate(value: string): void {
        this.startDate.set(value);
    }

    setEndDate(value: string): void {
        this.endDate.set(value);
    }

    setSelectedBankAccount(value: string): void {
        this.selectedBankAccountId.set(value);
        this.withdrawalFormError.set(null);
    }

    setWithdrawalAmount(value: string): void {
        this.withdrawalAmountInput.set(value);
        this.withdrawalFormError.set(null);
    }

    applyFilters(): void {
        this.loadWithdrawals(1);
    }

    clearFilters(): void {
        this.statusFilter.set('all');
        this.bankAccountFilter.set('all');
        this.qFilter.set('');
        this.startDate.set('');
        this.endDate.set('');
        this.loadWithdrawals(1);
    }

    goToPage(page: number): void {
        this.loadWithdrawals(page);
    }

    submitWithdrawal(event: Event): void {
        event.preventDefault();
        if (!this.isConfirmingWithdrawal()) {
            const validation = this.withdrawalValidationMessage();
            if (validation) {
                this.withdrawalFormError.set(validation);
                return;
            }
            this.isConfirmingWithdrawal.set(true);
            return;
        }
        this.createWithdrawal();
    }

    backToWithdrawalForm(): void {
        this.isConfirmingWithdrawal.set(false);
    }

    setMaxWithdrawalAmount(): void {
        const available = this.account()?.available ?? 0;
        const max = Math.min(available, this.maxWithdrawalCents);
        if (max < this.minWithdrawalCents) return;
        this.withdrawalAmountInput.set(this.formatCurrencyInput(max));
        this.withdrawalFormError.set(null);
    }

    createWithdrawal(): void {
        const validation = this.withdrawalValidationMessage();
        if (validation || this.isCreatingWithdrawal()) {
            this.withdrawalFormError.set(validation ?? null);
            return;
        }

        this.isCreatingWithdrawal.set(true);
        this.withdrawalService
            .create({
                bankAccountId: this.selectedBankAccountId(),
                amount: this.withdrawalAmountCents(),
            })
            .pipe(finalize(() => this.isCreatingWithdrawal.set(false)))
            .subscribe({
                next: (response) => {
                    this.withdrawalSheetState.set('closed');
                    this.withdrawalAmountInput.set('');
                    this.isConfirmingWithdrawal.set(false);
                    this.createdWithdrawalId.set(response.withdrawal.id);
                    this.reload(1);
                },
                error: (err) => this.withdrawalFormError.set(this.extractErrorMessage(err, 'Erro ao solicitar saque')),
            });
    }

    createVerifiedBankAccount(): void {
        const holderName = this.merchantName().trim();
        const holderDocument = this.merchantDocument();

        if (!holderName || !holderDocument) {
            this.bankAccountError.set('Não foi possível localizar nome e documento do merchant autenticado.');
            return;
        }

        this.isCreatingBankAccount.set(true);
        this.bankAccountError.set(null);
        this.bankAccountService
            .create({
                pixKey: holderDocument,
                pixKeyType: this.merchantPixKeyType(),
                holderName,
                holderDocument,
                isDefault: this.bankAccounts().length === 0,
            })
            .pipe(finalize(() => this.isCreatingBankAccount.set(false)))
            .subscribe({
                next: (account) => {
                    this.selectedBankAccountId.set(account.id);
                    this.loadBankAccounts();
                },
                error: (err) => this.bankAccountError.set(this.extractErrorMessage(err, 'Erro ao criar conta Pix')),
            });
    }

    deleteBankAccount(account: BankAccount): void {
        if (this.deletingBankAccountId()) return;
        if (account.hasWithdrawals) {
            this.bankAccountError.set('Esta conta tem saques vinculados e não pode ser removida.');
            return;
        }
        this.bankAccountToDelete.set(account);
        this.deleteBankAccountDialogState.set('open');
    }

    closeDeleteBankAccountDialog(): void {
        if (this.deletingBankAccountId()) return;
        this.deleteBankAccountDialogState.set('closed');
        this.bankAccountToDelete.set(null);
    }

    confirmDeleteBankAccount(): void {
        const account = this.bankAccountToDelete();
        if (!account || this.deletingBankAccountId()) return;

        this.deletingBankAccountId.set(account.id);
        this.bankAccountService
            .delete(account.id)
            .pipe(finalize(() => this.deletingBankAccountId.set(null)))
            .subscribe({
                next: () => {
                    this.deleteBankAccountDialogState.set('closed');
                    this.bankAccountToDelete.set(null);
                    this.loadBankAccounts();
                },
                error: (err) => this.bankAccountError.set(this.extractErrorMessage(err, 'Erro ao remover conta Pix')),
            });
    }

    setDefaultBankAccount(account: BankAccount): void {
        if (account.isDefault || this.settingDefaultBankAccountId()) return;

        this.settingDefaultBankAccountId.set(account.id);
        this.bankAccountError.set(null);
        this.bankAccountService
            .setDefault(account.id)
            .pipe(finalize(() => this.settingDefaultBankAccountId.set(null)))
            .subscribe({
                next: () => this.loadBankAccounts(),
                error: (err) => this.bankAccountError.set(this.extractErrorMessage(err, 'Erro ao tornar conta padrão')),
            });
    }

    copy(value?: string | null): void {
        if (!value) return;
        void navigator.clipboard?.writeText(value);
        this.copiedValue.set(value);
        window.setTimeout(() => {
            if (this.copiedValue() === value) this.copiedValue.set(null);
        }, 1500);
    }

    openDetail(withdrawal: Withdrawal): void {
        void this.router.navigate(['/dashboard/withdrawals', withdrawal.id]);
    }

    bankAccountLabel(bankAccountId: string): string {
        const account = this.bankAccounts().find((item) => item.id === bankAccountId);
        if (!account) return this.shortId(bankAccountId);
        return `${account.pixKeyType} ${this.maskDocument(account.pixKey)}`;
    }

    accountStatusLabel(account: BankAccount): string {
        return account.isVerified ? 'Verificada' : 'Não verificada';
    }

    shortId(value?: string | null): string {
        if (!value) return '—';
        return value.length <= 12 ? value : `${value.slice(0, 8)}…`;
    }

    activeFilterCount(): number {
        let count = 0;
        if (this.statusFilter() !== 'all') count += 1;
        if (this.bankAccountFilter() !== 'all') count += 1;
        if (this.startDate()) count += 1;
        if (this.endDate()) count += 1;
        if (this.qFilter().trim()) count += 1;
        return count;
    }

    goToCreatedWithdrawal(): void {
        const id = this.createdWithdrawalId();
        if (id) void this.router.navigate(['/dashboard/withdrawals', id]);
    }

    maskDocument(value?: string | null): string {
        const clean = this.cleanDocument(value);
        if (clean.length === 11) {
            return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
        }
        if (clean.length === 14) {
            return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`;
        }
        return value || '—';
    }

    private withdrawalValidationMessage(): string | null {
        const selected = this.selectedBankAccount();
        const amount = this.withdrawalAmountCents();
        const available = this.account()?.available ?? 0;

        if (!selected) return 'Selecione uma conta Pix verificada para receber o saque.';
        if (!selected.isVerified) return 'A conta Pix selecionada ainda não está verificada.';
        if (amount < this.minWithdrawalCents) return 'O valor mínimo para saque é R$ 10,00.';
        if (amount > this.maxWithdrawalCents) return 'O valor máximo para saque é R$ 5.000,00.';
        if (amount > available) return 'Saldo disponível insuficiente para esse saque.';
        if (amount <= this.feeCents) return 'O valor líquido precisa ser maior que zero.';

        return null;
    }

    private formatCurrencyInput(cents: number): string {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(cents / 100);
    }

    private cleanDocument(value?: string | null): string {
        return String(value ?? '').replace(/\D/g, '');
    }

    private extractErrorMessage(err: unknown, fallback: string): string {
        const error = err as {
            message?: string;
            error?: { message?: string; error?: { message?: string } };
        };

        return error?.error?.error?.message || error?.error?.message || error?.message || fallback;
    }
}
