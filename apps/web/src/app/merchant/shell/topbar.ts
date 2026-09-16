import { Component, computed, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';

import { MerThemeService } from '../ui';
import { SEGMENT_LABELS } from './console-nav';
import { ConsoleEnvironment } from './environment-selector';

interface Crumb {
  readonly label: string;
  readonly path: string;
  readonly isLast: boolean;
}

/**
 * A barra de cima: onde você está, e o que dá para fazer de qualquer lugar.
 *
 * A trilha lê os rótulos de `SEGMENT_LABELS`, derivado da navegação — não há
 * segunda tabela de nomes de rota para manter em dia. Segmento sem rótulo é um
 * id, e vira "Detalhe" em vez de vazar o uuid na tela.
 */
@Component({
  selector: 'app-console-topbar',
  standalone: true,
  imports: [RouterLink, ConsoleEnvironment],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css',
})
export class ConsoleTopbar {
  private readonly router = inject(Router);

  protected readonly theme = inject(MerThemeService);

  /** O botão da gaveta, que só existe no celular. */
  readonly openMenu = output<void>();

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly crumbs = computed<Crumb[]>(() => {
    const segments = (this.url() ?? '').split('?')[0].split('/').filter(Boolean);
    if (segments[0] !== 'dashboard') return [];

    let path = '';
    return segments.map((segment, index) => {
      path += `/${segment}`;
      return {
        label: SEGMENT_LABELS[segment] ?? 'Detalhe',
        path,
        isLast: index === segments.length - 1,
      };
    });
  });

  protected readonly nextSkin = computed(() =>
    this.theme.resolved() === 'night' ? 'papel' : 'carvão',
  );
}
