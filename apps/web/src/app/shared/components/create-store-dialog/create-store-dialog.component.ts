import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { StoreService } from '../../../core/services/store.service';
import { Sheet } from '../../ui';

@Component({
    selector: 'app-create-store-dialog',
    standalone: true,
    imports: [ReactiveFormsModule, Sheet],
    templateUrl: './create-store-dialog.component.html',
})
export class CreateStoreDialogComponent {
    private readonly fb = inject(FormBuilder);
    private readonly storeService = inject(StoreService);

    /** Quem abre o painel é a barra lateral. */
    readonly dialogState = input<'open' | 'closed'>('closed');

    /** Avisa que fechou — por Escape, pelo fundo, pelo X ou depois de criar. */
    readonly dialogClosed = output<void>();

    readonly isLoading = signal(false);

    readonly form = this.fb.nonNullable.group({
        name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(100)]],
        slug: [
            '',
            [
                Validators.minLength(3),
                Validators.maxLength(50),
                Validators.pattern(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/),
            ],
        ],
    });

    /** O slug nasce do nome: sem acento, sem espaço, sem surpresa na URL. */
    onNameInput() {
        const name = this.form.controls.name.value || '';
        const slug = name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        this.form.controls.slug.setValue(slug);
    }

    close() {
        if (this.isLoading()) return;
        this.onDialogClosed();
    }

    onDialogClosed() {
        this.form.reset();
        this.isLoading.set(false);
        this.dialogClosed.emit();
    }

    onSubmit() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.isLoading.set(true);
        const { name, slug } = this.form.getRawValue();

        this.storeService.createStore({ name, slug: slug || undefined }).subscribe({
            next: () => {
                toast.success('Loja criada.');
                this.isLoading.set(false);
                this.form.reset();
                this.dialogClosed.emit();
            },
            error: (err: { error?: { message?: string } }) => {
                this.isLoading.set(false);
                toast.error(err?.error?.message || 'Erro ao criar a loja.');
            },
        });
    }
}
