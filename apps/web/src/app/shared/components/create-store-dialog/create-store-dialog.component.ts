import { Component, inject, input, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { BrnDialogImports } from '@spartan-ng/brain/dialog';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmFormFieldImports } from '@spartan-ng/helm/form-field';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { provideIcons } from '@ng-icons/core';
import { lucideX, lucideLoader2 } from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';

import {
    DialogHeaderComponent,
    DialogFooterComponent,
} from '../dialog/dialog.component';
import { StoreService } from '../../../core/services/store.service';

@Component({
    selector: 'app-create-store-dialog',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        BrnDialogImports,
        HlmInputImports,
        HlmLabelImports,
        HlmButtonImports,
        HlmFormFieldImports,
        HlmIconImports,
        DialogHeaderComponent,
        DialogFooterComponent,
    ],
    providers: [provideIcons({ lucideX, lucideLoader2 })],
    templateUrl: './create-store-dialog.component.html',
})
export class CreateStoreDialogComponent {
    private readonly fb = inject(FormBuilder);
    private readonly storeService = inject(StoreService);

    /** Controls the dialog open/closed state from the parent. */
    readonly dialogState = input<'open' | 'closed'>('closed');

    /** Emits when the dialog is closed (by user action or after submission). */
    readonly dialogClosed = output<void>();

    readonly isLoading = signal(false);

    readonly form = this.fb.group({
        name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(100)]],
        slug: ['', [Validators.minLength(3), Validators.maxLength(50), Validators.pattern(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/)]],
    });

    /**
     * Auto-generates slug from name input (kebab-case).
     */
    onNameInput() {
        const name = this.form.get('name')?.value || '';
        const slug = name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        this.form.get('slug')?.setValue(slug);
    }

    onDialogClosed() {
        this.form.reset();
        this.isLoading.set(false);
        this.dialogClosed.emit();
    }

    onSubmit(dialogRef: any) {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.isLoading.set(true);
        const { name, slug } = this.form.getRawValue();

        this.storeService.createStore({ name: name!, slug: slug || undefined }).subscribe({
            next: () => {
                toast.success('Loja criada com sucesso!');
                this.isLoading.set(false);
                this.form.reset();
                dialogRef.close();
            },
            error: (err: any) => {
                this.isLoading.set(false);
                const message = err?.error?.message || 'Erro ao criar loja.';
                toast.error(message);
            },
        });
    }
}
