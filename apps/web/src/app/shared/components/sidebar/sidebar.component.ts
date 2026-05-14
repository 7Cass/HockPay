import { Component, computed, inject, OnInit, output, signal, HostListener, ElementRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { provideIcons } from '@ng-icons/core';
import {
    lucideLayoutDashboard,
    lucideCreditCard,
    lucideUsers,
    lucideSettings,
    lucideChevronDown,
    lucideLogOut,
    lucideStore,
    lucideCheck,
    lucidePlus,
    lucideKey,
    lucideWebhook,
    lucidePanelLeftClose,
    lucidePanelLeftOpen,
    lucideShoppingBag,
    lucideArrowRightLeft,
    lucideReceipt,
    lucideBell,
} from '@ng-icons/lucide';
import { StoreService, type Store } from '../../../core/services/store.service';
import { AuthService } from '../../../core/services/auth.service';
import { CreateStoreDialogComponent } from '../create-store-dialog/create-store-dialog.component';

interface MenuItem {
    label: string;
    icon: string;
    route: string;
}

interface MenuGroup {
    label: string;
    items: MenuItem[];
}

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, HlmButtonImports, HlmIconImports, CreateStoreDialogComponent],
    providers: [
        provideIcons({
            lucideLayoutDashboard,
            lucideCreditCard,
            lucideUsers,
            lucideSettings,
            lucideChevronDown,
            lucideLogOut,
            lucideStore,
            lucideCheck,
            lucidePlus,
            lucideKey,
            lucideWebhook,
            lucidePanelLeftClose,
            lucidePanelLeftOpen,
            lucideShoppingBag,
            lucideArrowRightLeft,
            lucideReceipt,
            lucideBell,
        }),
    ],
    templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
    private readonly router = inject(Router);
    private readonly eRef = inject(ElementRef);
    readonly storeService = inject(StoreService);
    readonly authService = inject(AuthService);

    /** Collapsed state — persisted in localStorage. */
    readonly isCollapsed = signal(
        typeof localStorage !== 'undefined' && localStorage.getItem('sidebar_collapsed') === 'true'
    );

    /** Emits collapse state changes so the parent layout can adjust. */
    readonly collapsedChange = output<boolean>();

    isStoreDropdownOpen = false;
    isUserDropdownOpen = false;
    createStoreDialogState: 'open' | 'closed' = 'closed';

    /** User initials computed from the current user's name. */
    readonly userInitials = computed(() => {
        const name = this.authService.currentUser()?.name;
        if (!name) return '?';
        return name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(word => word[0].toUpperCase())
            .join('');
    });

    /** Navigation items grouped by domain. */
    readonly menuGroups: MenuGroup[] = [
        {
            label: 'Principal',
            items: [
                { label: 'Visão Geral', icon: 'lucideLayoutDashboard', route: '/dashboard' },
                { label: 'Pagamentos', icon: 'lucideCreditCard', route: '/dashboard/payments' },
                { label: 'Produtos', icon: 'lucideShoppingBag', route: '/dashboard/products' },
                { label: 'Clientes', icon: 'lucideUsers', route: '/dashboard/customers' },
            ],
        },
        {
            label: 'Financeiro',
            items: [
                { label: 'Comprovantes', icon: 'lucideReceipt', route: '/dashboard/receipts' },
                { label: 'Saldo e Extrato', icon: 'lucideArrowRightLeft', route: '/dashboard/financials' },
            ],
        },
        {
            label: 'Integrações',
            items: [
                { label: 'API', icon: 'lucideKey', route: '/dashboard/api' },
                { label: 'Webhooks', icon: 'lucideWebhook', route: '/dashboard/webhooks' },
                { label: 'Alertas', icon: 'lucideBell', route: '/dashboard/alerts' },
            ],
        },
        {
            label: 'Configurações',
            items: [
                { label: 'Configurações', icon: 'lucideSettings', route: '/dashboard/settings' },
            ],
        },
    ];

    ngOnInit() {
        this.storeService.loadStores().subscribe();
        this.collapsedChange.emit(this.isCollapsed());
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        // If the click is outside the sidebar, or no dropdown is open, do nothing special
        if (!this.eRef.nativeElement.contains(event.target)) {
            this.isStoreDropdownOpen = false;
            this.isUserDropdownOpen = false;
        }
    }

    toggleCollapse() {
        const next = !this.isCollapsed();
        this.isCollapsed.set(next);
        this.collapsedChange.emit(next);
        localStorage.setItem('sidebar_collapsed', String(next));

        // Close dropdowns when toggling collapse state
        this.isStoreDropdownOpen = false;
        this.isUserDropdownOpen = false;
    }

    // Use stopPropagation on dropdown toggles to prevent document click from firing immediately
    toggleStoreDropdown(event?: MouseEvent) {
        if (event) event.stopPropagation();
        this.isStoreDropdownOpen = !this.isStoreDropdownOpen;
        if (this.isStoreDropdownOpen) this.isUserDropdownOpen = false;
    }

    toggleUserDropdown(event?: MouseEvent) {
        if (event) event.stopPropagation();
        this.isUserDropdownOpen = !this.isUserDropdownOpen;
        if (this.isUserDropdownOpen) this.isStoreDropdownOpen = false;
    }

    openCreateStoreDialog() {
        this.isStoreDropdownOpen = false;
        this.createStoreDialogState = 'open';
    }

    selectStore(store: Store) {
        this.storeService.switchStore(store.id).subscribe(() => {
            this.isStoreDropdownOpen = false;
        });
    }

    logout() {
        this.isUserDropdownOpen = false;
        this.authService.logout().subscribe({
            next: () => this.router.navigate(['/login']),
            error: () => this.router.navigate(['/login']),
        });
    }
}
