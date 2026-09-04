import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import {
    AbstractControl,
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
    lucideBan,
    lucideCheck,
    lucideCopy,
    lucideExternalLink,
    lucideLink,
    lucidePlus,
    lucideReceipt,
    lucideTrash2,
} from '@ng-icons/lucide';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { Subscription } from 'rxjs';
import {
    PaymentLinkRecord,
    PaymentLinkService,
    PaymentLinkStatus,
} from '../../../../core/services/payment-link.service';
import { ProductItem, ProductService } from '../../../../core/services/product.service';
import {
    PageHeader,
    PageState,
    Pagination,
    Sheet,
    StatusChip,
} from '../../../../shared/ui';
import { linkTone } from './link-tone';

type PaymentLinkFilterId = 'all' | 'active' | 'opened' | 'paid' | 'failed' | 'expired' | 'cancelled';
type ExpirationMode = 'never' | 'datetime';
/** Um link cobra um valor avulso OU itens do catalogo -- nunca os dois. */
type ChargeMode = 'amount' | 'items';

interface SelectedProduct {
    product: ProductItem;
    quantity: number;
}

interface PaymentLinkFilter {
    id: PaymentLinkFilterId;
    label: string;
    status?: PaymentLinkStatus;
    hasFailures?: boolean;
}

const FILTERS: PaymentLinkFilter[] = [
    { id: 'all', label: 'Todos' },
    { id: 'active', label: 'Ativos', status: 'ACTIVE' },
    { id: 'opened', label: 'Abertos', status: 'OPENED' },
    { id: 'paid', label: 'Pagos', status: 'PAID' },
    { id: 'failed', label: 'Com falha', hasFailures: true },
    { id: 'expired', label: 'Expirados', status: 'EXPIRED' },
    { id: 'cancelled', label: 'Cancelados', status: 'CANCELLED' },
];

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

function brlAmountValidator(control: AbstractControl): ValidationErrors | null {
    return parseBrlToCents(control.value) >= 1 ? null : { minAmount: true };
}

function expirationValidator(control: AbstractControl): ValidationErrors | null {
    const mode = control.get('expirationMode')?.value as ExpirationMode | undefined;
    const expiresAt = control.get('expiresAt')?.value as string | undefined;

    if (mode !== 'datetime') return null;
    if (!expiresAt) return { expiresAtRequired: true };

    const expiresAtDate = new Date(expiresAt);
    if (Number.isNaN(expiresAtDate.getTime()) || expiresAtDate.getTime() <= Date.now()) {
        return { expiresAtFuture: true };
    }

    return null;
}

@Component({
    selector: 'app-payment-links',
    standalone: true,
    imports: [
        CurrencyPipe,
        DatePipe,
        NgIcon,
        NgxMaskDirective,
        ReactiveFormsModule,
        RouterLink,
        PageHeader,
        PageState,
        Pagination,
        Sheet,
        StatusChip,
    ],
    providers: [
        provideIcons({
            lucideBan,
            lucideCheck,
            lucideCopy,
            lucideExternalLink,
            lucideLink,
            lucidePlus,
            lucideReceipt,
            lucideTrash2,
        }),
        provideNgxMask(),
    ],
    templateUrl: './payment-links.html',
    styleUrl: './payment-links.css',
})
export class PaymentLinks implements OnInit, OnDestroy {
    readonly service = inject(PaymentLinkService);
    private readonly products = inject(ProductService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private routeSub?: Subscription;
    readonly copiedId = signal<string | null>(null);
    readonly isCreating = signal(false);
    readonly sheetState = signal<'open' | 'closed'>('closed');
    readonly cancelDialogState = signal<'open' | 'closed'>('closed');
    readonly linkToCancel = signal<PaymentLinkRecord | null>(null);
    readonly isCancelling = signal(false);
    readonly activeFilter = signal<PaymentLinkFilterId>('all');
    readonly page = signal(1);
    readonly limit = signal(20);
    readonly filters = FILTERS;

    // --- Cobranca por catalogo -------------------------------------------
    readonly chargeMode = signal<ChargeMode>('amount');
    readonly productQuery = signal('');
    readonly productResults = signal<ProductItem[]>([]);
    readonly isSearchingProducts = signal(false);
    readonly selectedProducts = signal<SelectedProduct[]>([]);

    /** Total do link quando a cobranca vem do catalogo. */
    readonly itemsTotal = computed(() =>
        this.selectedProducts().reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0)
    );

    readonly form = new FormGroup(
        {
            amount: new FormControl<string>('', {
                nonNullable: true,
                validators: [brlAmountValidator],
            }),
            title: new FormControl<string>('', { nonNullable: true }),
            description: new FormControl<string>('', { nonNullable: true }),
            internalReference: new FormControl<string>('', { nonNullable: true }),
            expirationMode: new FormControl<ExpirationMode>('never', { nonNullable: true }),
            expiresAt: new FormControl<string>('', { nonNullable: true }),
        },
        { validators: [expirationValidator] }
    );

    readonly stats = computed(() => this.service.stats());
    readonly activeLinksCount = computed(() => {
        const stats = this.stats();
        return (stats?.active ?? 0) + (stats?.opened ?? 0);
    });

    ngOnInit() {
        this.routeSub = this.route.queryParamMap.subscribe((params) => {
            this.activeFilter.set(this.parseFilter(params.get('filter')));
            this.page.set(this.parsePositiveInt(params.get('page'), 1));
            this.limit.set(this.parsePositiveInt(params.get('limit'), 20));
            this.loadLinks();
        });
    }

    ngOnDestroy(): void {
        this.routeSub?.unsubscribe();
    }

    openCreateSheet() {
        this.resetForm();
        this.sheetState.set('open');
    }

    closeCreateSheet() {
        if (this.isCreating()) return;
        this.sheetState.set('closed');
    }

    /** O painel também fecha por Escape ou pelo fundo — o formulário limpa junto. */
    onSheetClosed() {
        this.sheetState.set('closed');
        this.resetForm();
    }

    selectFilter(filter: PaymentLinkFilterId) {
        this.activeFilter.set(filter);
        this.updateQueryParams(1);
    }

    selectExpirationMode(mode: ExpirationMode) {
        this.form.controls.expirationMode.setValue(mode);
        if (mode === 'never') {
            this.form.controls.expiresAt.setValue('');
        }
        this.form.updateValueAndValidity();
    }

    loadLinks() {
        const filter = this.filters.find(item => item.id === this.activeFilter());
        this.service.load({
            page: this.page(),
            limit: this.limit(),
            status: filter?.status,
            hasFailures: filter?.hasFailures,
        });
    }

    selectChargeMode(mode: ChargeMode) {
        this.chargeMode.set(mode);
        if (mode === 'amount') {
            this.clearProductSelection();
        } else {
            this.form.controls.amount.setValue('');
            if (this.productResults().length === 0) this.searchProducts();
        }
    }

    searchProducts() {
        this.isSearchingProducts.set(true);
        this.products.search({ search: this.productQuery().trim() || undefined }).subscribe({
            next: response => {
                this.productResults.set(response.products);
                this.isSearchingProducts.set(false);
            },
            error: () => {
                this.productResults.set([]);
                this.isSearchingProducts.set(false);
            },
        });
    }

    onProductQueryInput(value: string) {
        this.productQuery.set(value);
        this.searchProducts();
    }

    /** Somar quantidade em vez de duplicar a linha do mesmo produto. */
    addProduct(product: ProductItem) {
        this.selectedProducts.update(current => {
            const existing = current.find(entry => entry.product.id === product.id);
            if (existing) {
                return current.map(entry =>
                    entry.product.id === product.id
                        ? { ...entry, quantity: entry.quantity + 1 }
                        : entry
                );
            }
            return [...current, { product, quantity: 1 }];
        });
    }

    changeQuantity(productId: string, quantity: number) {
        if (!Number.isInteger(quantity) || quantity < 1) return;
        this.selectedProducts.update(current =>
            current.map(entry =>
                entry.product.id === productId ? { ...entry, quantity } : entry
            )
        );
    }

    removeProduct(productId: string) {
        this.selectedProducts.update(current =>
            current.filter(entry => entry.product.id !== productId)
        );
    }

    private clearProductSelection() {
        this.selectedProducts.set([]);
        this.productQuery.set('');
    }

    create() {
        const isItemsMode = this.chargeMode() === 'items';
        const amount = parseBrlToCents(this.form.controls.amount.value);

        if (this.isCreating()) return;

        // Cada modo tem sua propria condicao de validade: valor avulso exige
        // um amount valido, catalogo exige ao menos um item selecionado.
        if (isItemsMode) {
            if (this.selectedProducts().length === 0) return;
        } else if (this.form.controls.amount.invalid || amount < 1) {
            this.form.markAllAsTouched();
            return;
        }

        if (this.form.controls.expiresAt.invalid || this.form.errors) {
            this.form.markAllAsTouched();
            return;
        }

        const value = this.form.getRawValue();
        const expiresAt = value.expirationMode === 'datetime'
            ? new Date(value.expiresAt).toISOString()
            : undefined;

        this.isCreating.set(true);
        this.service.create({
            // A API exige exatamente um de amount ou items.
            amount: isItemsMode ? undefined : amount,
            items: isItemsMode
                ? this.selectedProducts().map(entry => ({
                    productId: entry.product.id,
                    quantity: entry.quantity,
                }))
                : undefined,
            title: value.title?.trim() || undefined,
            description: value.description?.trim() || undefined,
            internalReference: value.internalReference?.trim() || undefined,
            expiresAt,
        }).subscribe({
            next: result => {
                this.resetForm();
                this.isCreating.set(false);
                this.sheetState.set('closed');
                this.page.set(1);
                this.loadLinks();
                this.updateQueryParams(1);
                this.copy(result.paymentLink);
            },
            error: () => this.isCreating.set(false),
        });
    }

    cancel(link: PaymentLinkRecord) {
        if (!this.canCancel(link)) return;
        this.linkToCancel.set(link);
        this.cancelDialogState.set('open');
    }

    closeCancelDialog() {
        if (this.isCancelling()) return;
        this.cancelDialogState.set('closed');
        this.linkToCancel.set(null);
    }

    confirmCancel() {
        const link = this.linkToCancel();
        if (!link || !this.canCancel(link) || this.isCancelling()) return;

        this.isCancelling.set(true);
        this.service.cancel(link.id).subscribe({
            next: () => {
                this.isCancelling.set(false);
                this.cancelDialogState.set('closed');
                this.linkToCancel.set(null);
                this.loadLinks();
            },
            error: () => this.isCancelling.set(false),
        });
    }

    goToPage(page: number) {
        this.updateQueryParams(page);
    }

    openDetail(link: PaymentLinkRecord) {
        void this.router.navigate(['/dashboard/payment-links', link.id]);
    }

    copy(link: PaymentLinkRecord) {
        navigator.clipboard?.writeText(link.checkoutUrl);
        this.copiedId.set(link.id);
        window.setTimeout(() => {
            if (this.copiedId() === link.id) this.copiedId.set(null);
        }, 1800);
    }

    readonly linkTone = linkTone;

    canCancel(link: PaymentLinkRecord): boolean {
        return link.status !== 'PAID' && link.status !== 'CANCELLED' && link.status !== 'EXPIRED';
    }

    hasExpirationError(): boolean {
        return this.form.touched && (this.form.hasError('expiresAtRequired') || this.form.hasError('expiresAtFuture'));
    }

    expirationErrorMessage(): string {
        if (this.form.hasError('expiresAtRequired')) return 'Informe a data e hora de expiração.';
        if (this.form.hasError('expiresAtFuture')) return 'A expiração precisa ser uma data e hora futura.';
        return '';
    }

    resetForm() {
        this.form.reset({
            amount: '',
            title: '',
            description: '',
            internalReference: '',
            expirationMode: 'never',
            expiresAt: '',
        });
        this.form.markAsPristine();
        this.form.markAsUntouched();
        this.chargeMode.set('amount');
        this.clearProductSelection();
    }

    paymentTitle(link: PaymentLinkRecord): string {
        return link.title || link.description || 'Link avulso';
    }

    formatPercent(value: number | undefined): string {
        return `${Math.round((value ?? 0) * 100)}%`;
    }

    emptyStateMessage(): string {
        if (this.activeFilter() === 'all') {
            return 'Crie o primeiro link e mande a cobrança por onde o cliente estiver.';
        }
        const filter = this.filters.find(item => item.id === this.activeFilter());
        return `Nenhum link no filtro "${filter?.label ?? 'selecionado'}".`;
    }

    private updateQueryParams(page: number) {
        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                filter: this.activeFilter() === 'all' ? null : this.activeFilter(),
                page: page > 1 ? page : null,
                limit: this.limit() === 20 ? null : this.limit(),
            },
        });
    }

    private parseFilter(value: string | null): PaymentLinkFilterId {
        return this.filters.some(item => item.id === value) ? value as PaymentLinkFilterId : 'all';
    }

    private parsePositiveInt(value: string | null, fallback: number): number {
        const parsed = Number(value);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
    }
}
