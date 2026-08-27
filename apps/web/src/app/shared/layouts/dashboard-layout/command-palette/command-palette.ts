import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCornerDownLeft, lucideSearch } from '@ng-icons/lucide';

import { DASHBOARD_DESTINATIONS, DASHBOARD_NAV_ICONS, type NavItem } from '../dashboard-nav';
import { DashboardShell } from '../dashboard-shell';

/** Tira acento e caixa para o usuário poder digitar "saldo" e achar "Saldo". */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Paleta de comandos (⌘K).
 *
 * Só navega — a lista vem inteira de `DASHBOARD_DESTINATIONS`, então toda tela
 * nova do dashboard entra aqui de graça.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ ...DASHBOARD_NAV_ICONS, lucideCornerDownLeft, lucideSearch })],
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.css',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class CommandPalette {
  private readonly router = inject(Router);
  protected readonly shell = inject(DashboardShell);

  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly query = signal('');
  protected readonly cursor = signal(0);

  protected readonly results = computed<NavItem[]>(() => {
    const needle = fold(this.query().trim());
    if (!needle) return [...DASHBOARD_DESTINATIONS];

    return DASHBOARD_DESTINATIONS.filter((item) => {
      const haystack = fold([item.label, item.hint, item.route, ...(item.aliases ?? [])].join(' '));
      // Todos os termos precisam bater: "link pag" acha "Links de pagamento".
      return needle.split(/\s+/).every((term) => haystack.includes(term));
    });
  });

  constructor() {
    afterNextRender(() => this.input().nativeElement.focus());
  }

  protected onQuery(value: string): void {
    this.query.set(value);
    this.cursor.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.shell.closeCommand();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const target = this.results()[this.cursor()];
      if (target) this.go(target);
    }
  }

  private move(step: number): void {
    const total = this.results().length;
    if (!total) return;
    this.cursor.set((this.cursor() + step + total) % total);
  }

  protected go(item: NavItem): void {
    this.shell.closeCommand();
    this.router.navigateByUrl(item.route);
  }
}
