import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRefreshCcw } from '@ng-icons/lucide';
import { AuthService } from '../../../../core/services/auth.service';
import { StoreService } from '../../../../core/services/store.service';
import { CopyValue, PageHeader, PageState, StatusChip } from '../../../../shared/ui';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [CurrencyPipe, DatePipe, NgIcon, CopyValue, PageHeader, PageState, StatusChip],
    providers: [provideIcons({ lucideRefreshCcw })],
    templateUrl: './settings.html',
    styleUrl: './settings.css',
})
export class Settings implements OnInit {
    private readonly authService = inject(AuthService);
    private readonly storeService = inject(StoreService);

    readonly isLoading = signal(true);
    readonly error = signal<string | null>(null);
    readonly isSavingProfile = signal(false);
    readonly profileName = signal('');
    readonly profileCity = signal('');

    readonly currentUser = computed(() => this.authService.currentUser());
    readonly currentStore = computed(() => this.storeService.currentStore());
    readonly storesCount = computed(() => this.storeService.stores().length);

    ngOnInit(): void {
        this.reload();
    }

    reload(): void {
        this.isLoading.set(true);
        this.error.set(null);

        this.storeService.loadStores().subscribe({
            next: () => {
                const store = this.storeService.currentStore();
                this.profileName.set(store?.name ?? '');
                this.profileCity.set(store?.city ?? '');
                this.isLoading.set(false);
            },
            error: (err) => {
                this.error.set(err?.error?.message || err?.message || 'Erro ao carregar as lojas.');
                this.isLoading.set(false);
            },
        });
    }

    saveProfile(): void {
        const store = this.currentStore();
        if (!store) return;

        this.isSavingProfile.set(true);
        this.storeService
            .updateProfile(store.id, {
                name: this.profileName().trim() || store.name,
                city: this.profileCity().trim() || undefined,
            })
            .subscribe({
                next: () => {
                    this.isSavingProfile.set(false);
                    this.reload();
                },
                error: (err) => {
                    this.isSavingProfile.set(false);
                    this.error.set(err?.error?.message || err?.message || 'Erro ao salvar o perfil.');
                },
            });
    }

    formatPercent(value: number): string {
        return value.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }
}
