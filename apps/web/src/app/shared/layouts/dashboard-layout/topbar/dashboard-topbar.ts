import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBellRing, lucideMenu, lucideSearch } from '@ng-icons/lucide';
import { filter, map } from 'rxjs';

import { SEGMENT_LABELS } from '../dashboard-nav';
import { DashboardShell } from '../dashboard-shell';

interface Crumb {
  readonly label: string;
  readonly path: string;
  readonly isLast: boolean;
}

/**
 * Barra superior do dashboard: onde você está (breadcrumb) e o que dá para
 * fazer de qualquer lugar (⌘K, ambiente, alertas).
 *
 * O breadcrumb lê os rótulos de `SEGMENT_LABELS`, derivado da navegação — não
 * há segunda tabela de nomes de rota para manter em dia.
 */
@Component({
  selector: 'app-dashboard-topbar',
  standalone: true,
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ lucideBellRing, lucideMenu, lucideSearch })],
  templateUrl: './dashboard-topbar.html',
  styleUrl: './dashboard-topbar.css',
})
export class DashboardTopbar {
  private readonly router = inject(Router);
  protected readonly shell = inject(DashboardShell);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Atalho mostrado no gatilho da paleta — ⌘ no mac, Ctrl no resto. */
  protected readonly shortcut =
    typeof navigator !== 'undefined' && /mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  protected readonly crumbs = computed<Crumb[]>(() => {
    const segments = (this.url() ?? '').split('?')[0].split('/').filter(Boolean);
    if (segments[0] !== 'dashboard') return [];

    let path = '';
    return segments.map((segment, index) => {
      path += `/${segment}`;
      return {
        // Segmento sem rótulo é um id: vira "Detalhe" em vez de vazar o uuid.
        label: SEGMENT_LABELS[segment] ?? 'Detalhe',
        path,
        isLast: index === segments.length - 1,
      };
    });
  });
}
