import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCircleAlert,
  lucideCopy,
  lucideKey,
  lucidePlus,
  lucideRefreshCcw,
  lucideTrash2,
} from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';
import { ApiKey, ApiKeyService, Environment } from '../../../../core/services/api-key.service';
import { PageHeader, PageState, Sheet } from '../../../../shared/ui';

@Component({
  selector: 'app-api-keys',
  standalone: true,
  imports: [DatePipe, NgIcon, ReactiveFormsModule, PageHeader, PageState, Sheet],
  viewProviders: [
    provideIcons({
      lucideCheck,
      lucideCircleAlert,
      lucideCopy,
      lucideKey,
      lucidePlus,
      lucideRefreshCcw,
      lucideTrash2,
    }),
  ],
  templateUrl: './api-keys.html',
  styleUrl: './api-keys.css',
})
export class ApiKeys implements OnInit {
  readonly Environment = Environment;
  private readonly apiKeyService = inject(ApiKeyService);

  readonly embedded = input(false);
  readonly headerVariant = input<'default' | 'compact'>('default');
  readonly statsChange = output<{ total: number; isLoading: boolean; hasError: boolean }>();

  readonly keys = signal<ApiKey[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly newKeyName = new FormControl('', [Validators.required, Validators.minLength(3)]);
  readonly newKeyEnvironment = new FormControl<Environment>(Environment.TEST, {
    nonNullable: true,
  });
  readonly isCreating = signal(false);
  readonly createDialogState = signal<'closed' | 'open'>('closed');

  /** A chave em claro só existe aqui, e só até a janela fechar. */
  readonly newSecretKey = signal('');
  readonly copied = signal(false);
  readonly secretDialogState = signal<'closed' | 'open'>('closed');

  readonly keyToRevoke = signal<{ id: string; name: string } | null>(null);
  readonly revokeDialogState = signal<'closed' | 'open'>('closed');
  readonly isRevoking = signal(false);

  ngOnInit() {
    this.loadKeys();
  }

  openCreateDialog() {
    this.createDialogState.set('open');
  }

  closeCreateDialog() {
    if (this.isCreating()) return;
    this.createDialogState.set('closed');
    this.newKeyName.reset();
  }

  closeSecretDialog() {
    this.secretDialogState.set('closed');
    this.newSecretKey.set('');
    this.copied.set(false);
  }

  openRevokeDialog(id: string, name: string) {
    this.keyToRevoke.set({ id, name });
    this.revokeDialogState.set('open');
  }

  closeRevokeDialog() {
    if (this.isRevoking()) return;
    this.revokeDialogState.set('closed');
    this.keyToRevoke.set(null);
  }

  loadKeys() {
    this.isLoading.set(true);
    this.error.set(null);
    this.keys.set([]);
    this.emitStats();

    this.apiKeyService.list().subscribe({
      next: (response) => {
        this.keys.set(response.apiKeys);
        this.isLoading.set(false);
        this.emitStats();
      },
      error: () => {
        this.error.set('O servidor não respondeu. Tente de novo em instantes.');
        this.isLoading.set(false);
        this.emitStats();
      },
    });
  }

  createKey() {
    if (this.newKeyName.invalid) return;

    this.isCreating.set(true);

    this.apiKeyService
      .create({
        name: this.newKeyName.value!,
        environment: this.newKeyEnvironment.value,
      })
      .subscribe({
        next: (response) => {
          this.isCreating.set(false);
          this.newKeyName.reset();
          this.newKeyEnvironment.setValue(Environment.TEST);

          const { plainKey, ...record } = response;
          this.keys.update((keys) => [record as ApiKey, ...keys]);

          this.newSecretKey.set(plainKey);
          this.copied.set(false);
          this.createDialogState.set('closed');
          this.secretDialogState.set('open');
          this.emitStats();
        },
        error: () => {
          this.isCreating.set(false);
          toast.error('Não foi possível criar a chave. Tente de novo.');
        },
      });
  }

  revokeKey() {
    const key = this.keyToRevoke();
    if (!key) return;

    this.isRevoking.set(true);

    this.apiKeyService.revoke(key.id).subscribe({
      next: () => {
        this.isRevoking.set(false);
        this.revokeDialogState.set('closed');
        this.keyToRevoke.set(null);
        this.loadKeys();
      },
      error: () => {
        this.isRevoking.set(false);
        this.revokeDialogState.set('closed');
        this.keyToRevoke.set(null);
        toast.error('Não foi possível revogar a chave.');
      },
    });
  }

  copyToClipboard() {
    const secret = this.newSecretKey();
    if (!secret) return;

    void navigator.clipboard?.writeText(secret);
    this.copied.set(true);
    window.setTimeout(() => this.copied.set(false), 3000);
  }

  private emitStats() {
    this.statsChange.emit({
      total: this.keys().length,
      isLoading: this.isLoading(),
      hasError: !!this.error(),
    });
  }
}
