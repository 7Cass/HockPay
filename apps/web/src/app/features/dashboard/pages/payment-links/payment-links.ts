import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import {
    AbstractControl,
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideAlertTriangle,
    lucideCheckCircle2,
    lucideClock,
    lucideCopy,
    lucideExternalLink,
    lucideLink,
    lucidePlus,
    lucideReceipt,
    lucideChevronLeft,
    lucideChevronRight,
    lucideXCircle,
} from '@ng-icons/lucide';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { Subscription } from 'rxjs';
import { DialogImports } from '../../../../shared/components/dialog/dialog.component';
import {
    PaymentLinkRecord,
    PaymentLinkService,
    PaymentLinkStatus,
} from '../../../../core/services/payment-link.service';

type PaymentLinkFilterId = 'all' | 'active' | 'opened' | 'paid' | 'failed' | 'expired' | 'cancelled';
type ExpirationMode = 'never' | 'datetime';

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
        CommonModule,
        ReactiveFormsModule,
        RouterLink,
        CurrencyPipe,
        DatePipe,
        NgIconComponent,
        NgxMaskDirective,
        ...HlmBadgeImports,
        ...HlmButtonImports,
        ...HlmInputImports,
        ...HlmSheetImports,
        ...HlmTableImports,
        HlmIconImports,
        ...DialogImports,
    ],
    providers: [
        provideIcons({
            lucideAlertTriangle,
            lucideCheckCircle2,
            lucideClock,
            lucideCopy,
            lucideExternalLink,
            lucideLink,
            lucidePlus,
            lucideReceipt,
            lucideChevronLeft,
            lucideChevronRight,
            lucideXCircle,
        }),
        provideNgxMask(),
    ],
    templateUrl: './payment-links.html',
})
export class PaymentLinks implements OnInit, OnDestroy {
    readonly service = inject(PaymentLinkService);
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

    onSheetStateChange(state: string) {
        this.sheetState.set(state === 'open' ? 'open' : 'closed');

        if (state !== 'open') {
            this.resetForm();
        }
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

    create() {
        const amount = parseBrlToCents(this.form.controls.amount.value);

        if (this.form.invalid || this.isCreating() || amount < 1) {
            this.form.markAllAsTouched();
            return;
        }

        const value = this.form.getRawValue();
        const expiresAt = value.expirationMode === 'datetime'
            ? new Date(value.expiresAt).toISOString()
            : undefined;

        this.isCreating.set(true);
        this.service.create({
            amount,
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

    setLimit(event: Event) {
        this.limit.set(this.parsePositiveInt(this.eventValue(event), 20));
        this.updateQueryParams(1);
    }

    changePage(delta: number) {
        const nextPage = this.page() + delta;
        if (nextPage < 1 || nextPage > this.service.totalPages()) return;
        this.updateQueryParams(nextPage);
    }

    openDetail(link: PaymentLinkRecord) {
        this.router.navigate(['/dashboard/payment-links', link.id]);
    }

    copy(link: PaymentLinkRecord) {
        navigator.clipboard?.writeText(link.checkoutUrl);
        this.copiedId.set(link.id);
        window.setTimeout(() => {
            if (this.copiedId() === link.id) this.copiedId.set(null);
        }, 1800);
    }

    statusLabel(status: string): string {
        const labels: Record<string, string> = {
            ACTIVE: 'Ativo',
            OPENED: 'Aberto',
            PAID: 'Pago',
            EXPIRED: 'Expirado',
            CANCELLED: 'Cancelado',
        };
        return labels[status] ?? status;
    }

    statusClass(status: string): string {
        const classes: Record<string, string> = {
            ACTIVE: 'border-blue-200 bg-blue-50 text-blue-700',
            OPENED: 'border-amber-200 bg-amber-50 text-amber-700',
            PAID: 'border-emerald-200 bg-emerald-50 text-emerald-700',
            EXPIRED: 'border-zinc-200 bg-zinc-100 text-zinc-700',
            CANCELLED: 'border-red-200 bg-red-50 text-red-700',
        };
        return classes[status] ?? 'border-zinc-200 bg-zinc-100 text-zinc-700';
    }

    statusIcon(status: string): string {
        const icons: Record<string, string> = {
            ACTIVE: 'lucideLink',
            OPENED: 'lucideClock',
            PAID: 'lucideCheckCircle2',
            EXPIRED: 'lucideXCircle',
            CANCELLED: 'lucideXCircle',
        };
        return icons[status] ?? 'lucideClock';
    }

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
    }

    paymentTitle(link: PaymentLinkRecord): string {
        return link.title || link.description || 'Link avulso';
    }

    formatPercent(value: number | undefined): string {
        return `${Math.round((value ?? 0) * 100)}%`;
    }

    emptyStateMessage(): string {
        if (this.activeFilter() === 'all') return 'Nenhum link de pagamento encontrado.';
        const filter = this.filters.find(item => item.id === this.activeFilter());
        return `Nenhum link encontrado para o filtro "${filter?.label ?? 'selecionado'}".`;
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

    private eventValue(event: Event): string {
        return (event.target as HTMLSelectElement | null)?.value ?? '';
    }
}
