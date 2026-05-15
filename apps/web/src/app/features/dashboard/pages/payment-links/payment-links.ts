import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PaymentLinkItem, PaymentLinkService } from '../../../../core/services/payment-link.service';

@Component({
    selector: 'app-payment-links',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe],
    templateUrl: './payment-links.html',
})
export class PaymentLinks implements OnInit {
    readonly service = inject(PaymentLinkService);
    readonly copiedId = signal<string | null>(null);
    readonly isCreating = signal(false);

    readonly form = new FormGroup({
        amount: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
        title: new FormControl(''),
        description: new FormControl(''),
        internalReference: new FormControl(''),
        expiresAt: new FormControl(''),
    });

    readonly stats = computed(() => this.service.stats());

    ngOnInit() {
        this.service.load({ page: 1, limit: 50 });
    }

    create() {
        if (this.form.invalid || this.isCreating()) {
            this.form.markAllAsTouched();
            return;
        }

        const value = this.form.getRawValue();
        this.isCreating.set(true);
        this.service.create({
            amount: Math.round(Number(value.amount) * 100),
            title: value.title?.trim() || undefined,
            description: value.description?.trim() || undefined,
            internalReference: value.internalReference?.trim() || undefined,
            expiresAt: value.expiresAt || undefined,
        }).subscribe({
            next: result => {
                this.form.reset();
                this.isCreating.set(false);
                this.service.load({ page: 1, limit: 50 });
                this.copy(result.paymentLink);
            },
            error: () => this.isCreating.set(false),
        });
    }

    cancel(link: PaymentLinkItem) {
        if (link.status === 'PAID' || link.status === 'CANCELLED') return;
        this.service.cancel(link.id).subscribe(() => this.service.load({ page: 1, limit: 50 }));
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
            ACTIVE: 'bg-blue-50 text-blue-700 ring-blue-200',
            OPENED: 'bg-amber-50 text-amber-700 ring-amber-200',
            PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
            EXPIRED: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
            CANCELLED: 'bg-red-50 text-red-700 ring-red-200',
        };
        return classes[status] ?? 'bg-zinc-100 text-zinc-700 ring-zinc-200';
    }

    formatPercent(value: number | undefined): string {
        return `${Math.round((value ?? 0) * 100)}%`;
    }
}
