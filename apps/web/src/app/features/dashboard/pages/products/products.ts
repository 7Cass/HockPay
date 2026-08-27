import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
    lucideArchive,
    lucidePackagePlus,
    lucidePencil,
    lucideRefreshCw,
    lucideRotateCcw,
    lucideSave,
} from '@ng-icons/lucide';
import { ProductItem, ProductService } from '../../../../core/services/product.service';
import { PageHeader, PageState, Sheet, StatusChip } from '../../../../shared/ui';

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
    selector: 'app-products',
    standalone: true,
    imports: [
        CurrencyPipe,
        DatePipe,
        NgIcon,
        ReactiveFormsModule,
        PageHeader,
        PageState,
        Sheet,
        StatusChip,
    ],
    providers: [
        provideIcons({
            lucideArchive,
            lucidePackagePlus,
            lucidePencil,
            lucideRefreshCw,
            lucideRotateCcw,
            lucideSave,
        }),
    ],
    templateUrl: './products.html',
    styleUrl: './products.css',
})
export class Products implements OnInit {
    readonly service = inject(ProductService);
    readonly isSaving = signal(false);
    readonly isArchiving = signal(false);
    readonly editingProduct = signal<ProductItem | null>(null);
    readonly productToArchive = signal<ProductItem | null>(null);
    readonly archiveDialogState = signal<'open' | 'closed'>('closed');
    readonly formSheetOpen = signal(false);
    readonly activeFilter = signal<'active' | 'inactive' | 'all'>('active');
    readonly metadataError = signal<string | null>(null);

    readonly form = new FormGroup({
        externalId: new FormControl<string>('', { nonNullable: true }),
        name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        description: new FormControl<string>('', { nonNullable: true }),
        price: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        imageUrl: new FormControl<string>('', { nonNullable: true }),
        metadata: new FormControl<string>('', { nonNullable: true }),
    });

    ngOnInit() {
        this.load();
    }

    load() {
        this.service.load({
            page: 1,
            limit: 50,
            isActive: this.activeFilter() === 'all' ? undefined : this.activeFilter() === 'active',
        });
    }

    setActiveFilter(value: 'active' | 'inactive' | 'all') {
        this.activeFilter.set(value);
        this.load();
    }

    emptyStateMessage(): string {
        if (this.activeFilter() === 'inactive') return 'Nenhum produto arquivado até agora.';
        if (this.activeFilter() === 'all') return 'O catálogo ainda não tem nenhum produto.';
        return 'Nenhum produto ativo. Crie o primeiro para abrir checkout sessions pela API.';
    }

    openCreateSheet() {
        this.resetForm();
        this.formSheetOpen.set(true);
    }

    closeFormSheet() {
        if (this.isSaving()) return;
        this.formSheetOpen.set(false);
        this.resetForm();
    }

    edit(product: ProductItem) {
        this.editingProduct.set(product);
        this.metadataError.set(null);
        this.form.reset({
            externalId: product.externalId ?? '',
            name: product.name,
            description: product.description ?? '',
            price: String((product.price / 100).toFixed(2)).replace('.', ','),
            imageUrl: product.imageUrl ?? '',
            metadata: product.metadata ? JSON.stringify(product.metadata, null, 2) : '',
        });
        this.formSheetOpen.set(true);
    }

    archive(product: ProductItem) {
        if (!product.isActive) return;
        this.productToArchive.set(product);
        this.archiveDialogState.set('open');
    }

    closeArchiveDialog() {
        if (this.isArchiving()) return;
        this.archiveDialogState.set('closed');
        this.productToArchive.set(null);
    }

    confirmArchive() {
        const product = this.productToArchive();
        if (!product || this.isArchiving()) return;

        this.isArchiving.set(true);
        this.service.update(product.id, { isActive: false }).subscribe({
            next: () => {
                this.isArchiving.set(false);
                this.archiveDialogState.set('closed');
                this.productToArchive.set(null);
                this.load();
            },
            error: () => this.isArchiving.set(false),
        });
    }

    reactivate(product: ProductItem) {
        if (product.isActive) return;
        this.service.update(product.id, { isActive: true }).subscribe(() => this.load());
    }

    resetForm() {
        this.editingProduct.set(null);
        this.metadataError.set(null);
        this.form.reset({
            externalId: '',
            name: '',
            description: '',
            price: '',
            imageUrl: '',
            metadata: '',
        });
        this.form.markAsPristine();
        this.form.markAsUntouched();
    }

    save() {
        if (this.form.invalid || this.isSaving()) {
            this.form.markAllAsTouched();
            return;
        }

        const raw = this.form.getRawValue();
        const metadata = this.parseMetadata(raw.metadata);
        if (metadata === false) return;

        const payload = {
            externalId: raw.externalId.trim() || undefined,
            name: raw.name.trim(),
            description: raw.description.trim() || undefined,
            price: parseBrlToCents(raw.price),
            imageUrl: raw.imageUrl.trim() || undefined,
            metadata,
        };
        const editing = this.editingProduct();

        this.isSaving.set(true);
        const request = editing
            ? this.service.update(editing.id, payload)
            : this.service.create(payload);

        request.subscribe({
            next: () => {
                this.isSaving.set(false);
                this.formSheetOpen.set(false);
                this.resetForm();
                this.load();
            },
            error: () => this.isSaving.set(false),
        });
    }

    private parseMetadata(value: string): Record<string, unknown> | undefined | false {
        this.metadataError.set(null);
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        try {
            const parsed = JSON.parse(trimmed);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                this.metadataError.set('Metadata precisa ser um objeto JSON.');
                return false;
            }
            return parsed as Record<string, unknown>;
        } catch {
            this.metadataError.set('Metadata precisa ser um JSON válido.');
            return false;
        }
    }
}
