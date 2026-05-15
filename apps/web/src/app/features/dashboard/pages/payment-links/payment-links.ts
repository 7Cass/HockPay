import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
    AbstractControl,
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideAlertTriangle,
    lucideBadgeDollarSign,
    lucideCheckCircle2,
    lucideClock,
    lucideCopy,
    lucideExternalLink,
    lucideLink,
    lucidePlus,
    lucideReceipt,
    lucideXCircle,
} from '@ng-icons/lucide';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import {
    PaymentLinkItem,
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
    ],
    providers: [
        provideIcons({
            lucideAlertTriangle,
            lucideBadgeDollarSign,
            lucideCheckCircle2,
            lucideClock,
            lucideCopy,
            lucideExternalLink,
            lucideLink,
            lucidePlus,
            lucideReceipt,
            lucideXCircle,
        }),
        provideNgxMask(),
    ],
    templateUrl: './payment-links.html',
})
export class PaymentLinks implements OnInit {
    readonly service = inject(PaymentLinkService);
    readonly copiedId = signal<string | null>(null);
    readonly isCreating = signal(false);
    readonly sheetState = signal<'open' | 'closed'>('closed');
    readonly activeFilter = signal<PaymentLinkFilterId>('all');
    readonly filters = FILTERS;

    readonly form = new FormGroup(
        {
            amount: new FormControl<string>('', {
                nonNullable: true,
                validators: [Validators.required, brlAmountValidator],
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
        this.loadLinks();
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
        this.loadLinks();
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
            page: 1,
            limit: 50,
            status: filter?.status,
            hasFailures: filter?.hasFailures,
        });
    }

    create() {
        if (this.form.invalid || this.isCreating()) {
            this.form.markAllAsTouched();
            return;
        }

        const value = this.form.getRawValue();
        const expiresAt = value.expirationMode === 'datetime'
            ? new Date(value.expiresAt).toISOString()
            : undefined;

        this.isCreating.set(true);
        this.service.create({
            amount: parseBrlToCents(value.amount),
            title: value.title?.trim() || undefined,
            description: value.description?.trim() || undefined,
            internalReference: value.internalReference?.trim() || undefined,
            expiresAt,
        }).subscribe({
            next: result => {
                this.resetForm();
                this.isCreating.set(false);
                this.sheetState.set('closed');
                this.loadLinks();
                this.copy(result.paymentLink);
            },
            error: () => this.isCreating.set(false),
        });
    }

    cancel(link: PaymentLinkItem) {
        if (!this.canCancel(link)) return;
        this.service.cancel(link.id).subscribe(() => this.loadLinks());
    }

    copy(link: PaymentLinkItem) {
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

    canCancel(link: PaymentLinkItem): boolean {
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

    paymentTitle(link: PaymentLinkItem): string {
        return link.title || link.description || 'Link avulso';
    }

    formatPercent(value: number | undefined): string {
        return `${Math.round((value ?? 0) * 100)}%`;
    }
}
