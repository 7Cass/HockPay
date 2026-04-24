import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiKeyService, ApiKey, Environment } from '../../../../core/services/api-key.service';
import { DialogImports } from '../../../../shared/components/dialog/dialog.component';

// Spartan UI
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';

// Icons
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import {
  lucideRefreshCcw,
  lucidePlus,
  lucideTrash2,
  lucideKey,
  lucideXCircle,
  lucideCheck,
  lucideCopy,
  lucideAlertTriangle,
} from '@ng-icons/lucide';

@Component({
  selector: 'app-api-keys',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePipe,
    // UI Components
    ...HlmButtonImports,
    ...HlmTableImports,
    ...HlmBadgeImports,
    ...HlmSpinnerImports,
    NgIconComponent,
    HlmIconImports,
    ...DialogImports,
  ],
  viewProviders: [
    provideIcons({
      lucideRefreshCcw,
      lucidePlus,
      lucideTrash2,
      lucideKey,
      lucideXCircle,
      lucideCheck,
      lucideCopy,
      lucideAlertTriangle,
    }),
  ],
  templateUrl: './api-keys.html',
})
export class ApiKeys implements OnInit {
  private readonly apiKeyService = inject(ApiKeyService);
  readonly embedded = input(false);
  readonly headerVariant = input<'default' | 'compact'>('default');
  readonly statsChange = output<{ total: number; isLoading: boolean; hasError: boolean }>();

  // State Signals
  testKeys = signal<ApiKey[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  // Creation State
  isCreating = signal<boolean>(false);
  newKeyName = new FormControl('', [Validators.required, Validators.minLength(3)]);
  createDialogState = signal<'closed' | 'open'>('closed');

  // Secret Key Modal State
  newSecretKey = signal<string>('');
  copied = signal<boolean>(false);
  secretDialogState = signal<'closed' | 'open'>('closed');

  // Revoke Dialog State
  keyToRevoke = signal<{ id: string; name: string } | null>(null);
  revokeDialogState = signal<'closed' | 'open'>('closed');
  isRevoking = signal<boolean>(false);

  ngOnInit() {
    this.loadKeys();
  }

  openCreateDialog() {
    this.createDialogState.set('open');
  }

  closeCreateDialog() {
    this.createDialogState.set('closed');
    this.newKeyName.reset();
  }

  closeSecretDialog() {
    this.secretDialogState.set('closed');
  }

  openRevokeDialog(id: string, name: string) {
    this.keyToRevoke.set({ id, name });
    this.revokeDialogState.set('open');
  }

  closeRevokeDialog() {
    this.revokeDialogState.set('closed');
    // small delay to let the dialog animation close before nullifying content
    setTimeout(() => this.keyToRevoke.set(null), 200);
  }

  loadKeys() {
    this.isLoading.set(true);
    this.error.set(null);
    this.testKeys.set([]);
    this.emitStats();

    this.apiKeyService.list().subscribe({
      next: (response) => {
        // We simulate applying the DEV MODE toggle by filtering locally for TEST keys
        const testKeysOnly = response.apiKeys.filter((k) => k.environment === Environment.TEST);
        this.testKeys.set(testKeysOnly);
        this.isLoading.set(false);
        this.emitStats();
      },
      error: (err) => {
        console.error('Failed to load api keys', err);
        this.error.set('Houve um erro ao se comunicar com o servidor. Tente novamente mais tarde.');
        this.isLoading.set(false);
        this.emitStats();
      },
    });
  }

  createKey() {
    if (this.newKeyName.invalid) return;

    this.isCreating.set(true);
    const keyName = this.newKeyName.value!;

    this.apiKeyService.create({ name: keyName, environment: Environment.TEST }).subscribe({
      next: (response) => {
        // Reset creating state
        this.isCreating.set(false);
        this.newKeyName.reset();

        // Add the new key to the local list (stripping the plainKey)
        const newKeyEntity: ApiKey = { ...response, plainKey: undefined } as any;
        this.testKeys.update((keys) => [newKeyEntity, ...keys]);

        // Show the one-time plain key in the modal explicitly
        this.newSecretKey.set(response.plainKey);
        this.copied.set(false);

        // Hide create dialog and show secret dialog via Signals
        this.createDialogState.set('closed');
        this.secretDialogState.set('open');
        this.emitStats();
      },
      error: (err) => {
        this.isCreating.set(false);
        console.error('Failed to create api key', err);
        alert('Falha ao criar chave de API. Tente novamente.');
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
        this.closeRevokeDialog();
        this.loadKeys();
      },
      error: (err) => {
        this.isRevoking.set(false);
        console.error('Failed to revoke api key', err);
        alert('Falha ao revogar chave de API.');
      },
    });
  }

  copyToClipboard() {
    if (!this.newSecretKey()) return;

    navigator.clipboard.writeText(this.newSecretKey()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 3000);
    });
  }

  private emitStats() {
    this.statsChange.emit({
      total: this.testKeys().length,
      isLoading: this.isLoading(),
      hasError: !!this.error(),
    });
  }
}
