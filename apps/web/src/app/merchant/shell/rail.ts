import { Component, ElementRef, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { MerchantSession, type Store } from '../data/session';
import { MerButton, MerField } from '../ui';
import { CONSOLE_NAV, CONSOLE_SETTINGS } from './console-nav';

/**
 * O trilho: marca, loja aberta, destinos e conta.
 *
 * É a única parte da tela que nunca muda de conteúdo, e é ela que dá ao console
 * uma silhueta reconhecível de longe. Dois modos, um template: `rail` no
 * desktop e `drawer` no celular, onde ele entra por cima e fecha ao navegar.
 *
 * A criação de loja mora aqui dentro, num campo só, porque é onde a pergunta
 * aparece — "esta loja não é a que eu quero" — e não numa tela de configuração
 * que ninguém abre para isso.
 */
@Component({
  selector: 'app-console-rail',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MerButton, MerField],
  templateUrl: './rail.html',
  styleUrl: './rail.css',
  host: {
    '[class.is-drawer]': "variant() === 'drawer'",
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeMenus()',
  },
})
export class ConsoleRail {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);

  protected readonly session = inject(MerchantSession);

  readonly variant = input<'rail' | 'drawer'>('rail');

  /** A gaveta fecha quando se navega; no desktop, ninguém escuta. */
  readonly navigated = output<void>();

  protected readonly groups = CONSOLE_NAV;
  protected readonly settings = CONSOLE_SETTINGS;

  protected readonly storeMenuOpen = signal(false);
  protected readonly userMenuOpen = signal(false);
  protected readonly newStore = signal('');
  protected readonly creating = signal(false);
  protected readonly createError = signal('');

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.closeMenus();
  }

  protected closeMenus(): void {
    this.storeMenuOpen.set(false);
    this.userMenuOpen.set(false);
  }

  protected toggleStoreMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.userMenuOpen.set(false);
    this.createError.set('');
    this.storeMenuOpen.update((open) => !open);
  }

  protected toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.storeMenuOpen.set(false);
    this.userMenuOpen.update((open) => !open);
  }

  protected selectStore(store: Store): void {
    this.closeMenus();
    this.session.switchStore(store);
  }

  protected onNavigate(): void {
    this.closeMenus();
    this.navigated.emit();
  }

  protected createStore(): void {
    const name = this.newStore().trim();
    if (!name || this.creating()) return;

    this.creating.set(true);
    this.createError.set('');
    this.session.createStore(name, (message) => {
      this.creating.set(false);
      this.createError.set(message);
    });
  }

  protected logout(): void {
    this.closeMenus();
    this.session.logout(() => void this.router.navigate(['/login']));
  }
}
