import { Component, computed, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { provideIcons } from '@ng-icons/core';
import { lucideBell, lucideChevronRight } from '@ng-icons/lucide';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HlmIconImports, HlmSwitchImports],
  providers: [provideIcons({ lucideBell, lucideChevronRight })],
  templateUrl: './dashboard-layout.html',
})
export class DashboardLayout {
  private readonly router = inject(Router);

  isMobileMenuOpen = false;
  isSidebarCollapsed = typeof localStorage !== 'undefined' && localStorage.getItem('sidebar_collapsed') === 'true';

  /** Current URL signal to compute breadcrumbs. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  /** Map of route paths to human-readable names. */
  private readonly routeNames: Record<string, string> = {
    'dashboard': 'Visão Geral',
    'payments': 'Pagamentos',
    'customers': 'Clientes',
    'api-keys': 'API Keys',
    'webhooks': 'Webhooks',
    'stores': 'Lojas',
    'settings': 'Configurações',
  };

  /** Computes the breadcrumb segments based on the current URL. */
  readonly breadcrumbs = computed(() => {
    const url = this.currentUrl();
    if (!url) return [];

    // Remove query params and split by '/'
    const segments = url.split('?')[0].split('/').filter(Boolean);

    // Only process routes starting with 'dashboard'
    if (segments[0] !== 'dashboard') return [];

    const breadcrumbs = [];
    let currentPath = '';

    for (const segment of segments) {
      currentPath += `/${segment}`;
      breadcrumbs.push({
        label: this.routeNames[segment] || segment,
        path: currentPath,
        isLast: false // Will be updated
      });
    }

    // Mark the last element
    if (breadcrumbs.length > 0) {
      breadcrumbs[breadcrumbs.length - 1].isLast = true;
    }

    return breadcrumbs;
  });

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  onSidebarCollapse(collapsed: boolean) {
    this.isSidebarCollapsed = collapsed;
  }
}
