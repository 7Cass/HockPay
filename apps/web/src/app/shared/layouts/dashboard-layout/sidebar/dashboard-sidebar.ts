import { Component, ElementRef, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideChevronsUpDown,
  lucideLogOut,
  lucidePanelLeft,
  lucidePlus,
  lucideSettings,
  lucideStore,
  lucideX,
} from '@ng-icons/lucide';

import { AuthService } from '../../../../core/services/auth.service';
import { StoreService, type Store } from '../../../../core/services/store.service';
import { CreateStoreDialogComponent } from '../../../components/create-store-dialog/create-store-dialog.component';
import { DASHBOARD_NAV, DASHBOARD_NAV_ICONS } from '../dashboard-nav';
import { DashboardShell } from '../dashboard-shell';

/**
 * Sidebar do dashboard.
 *
 * Dois modos, um template: `rail` (desktop, recolhível) e `drawer` (mobile,
 * sempre expandida, com botão de fechar). Recolher é só CSS — os rótulos
 * encolhem em vez de sumir, para a transição não piscar.
 */
@Component({
  selector: 'app-dashboard-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgIcon, CreateStoreDialogComponent],
  providers: [
    provideIcons({
      ...DASHBOARD_NAV_ICONS,
      lucideCheck,
      lucideChevronsUpDown,
      lucideLogOut,
      lucidePanelLeft,
      lucidePlus,
      lucideSettings,
      lucideStore,
      lucideX,
    }),
  ],
  templateUrl: './dashboard-sidebar.html',
  styleUrl: './dashboard-sidebar.css',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeMenus()',
  },
})
export class DashboardSidebar {
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly shell = inject(DashboardShell);
  protected readonly stores = inject(StoreService);
  protected readonly auth = inject(AuthService);

  /** `drawer` ignora o estado de recolhido e ganha o botão de fechar. */
  readonly variant = input<'rail' | 'drawer'>('rail');

  protected readonly groups = DASHBOARD_NAV;

  protected readonly collapsed = computed(
    () => this.variant() === 'rail' && this.shell.asideCollapsed(),
  );

  protected readonly storeMenuOpen = signal(false);
  protected readonly userMenuOpen = signal(false);
  protected createStoreDialogState: 'open' | 'closed' = 'closed';

  /** Iniciais do merchant — o avatar é tipografia, não imagem. */
  protected readonly userInitials = computed(() => {
    const name = this.auth.currentUser()?.name?.trim();
    if (!name) return '—';
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('');
  });

  /** Primeira letra da loja, usada quando a sidebar está em trilho. */
  protected readonly storeInitial = computed(
    () => this.stores.currentStore()?.name?.trim()?.[0]?.toUpperCase() ?? '·',
  );

  constructor() {
    this.stores.loadStores().subscribe();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeMenus();
    }
  }

  protected closeMenus(): void {
    this.storeMenuOpen.set(false);
    this.userMenuOpen.set(false);
  }

  protected toggleStoreMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.userMenuOpen.set(false);
    this.storeMenuOpen.update((open) => !open);
  }

  protected toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.storeMenuOpen.set(false);
    this.userMenuOpen.update((open) => !open);
  }

  protected selectStore(store: Store): void {
    this.closeMenus();
    this.stores.switchStore(store.id).subscribe();
  }

  protected openCreateStoreDialog(): void {
    this.closeMenus();
    this.createStoreDialogState = 'open';
  }

  protected onNavigate(): void {
    this.closeMenus();
    this.shell.closeDrawer();
  }

  protected logout(): void {
    this.closeMenus();
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
