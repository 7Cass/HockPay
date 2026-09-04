import { Injectable, effect, signal } from '@angular/core';

const COLLAPSED_KEY = 'hockpay:aside-collapsed';

function readCollapsed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(COLLAPSED_KEY) === 'true';
}

/**
 * Estado do shell do dashboard.
 *
 * Existe para que sidebar, topbar e paleta conversem sem prop drilling: o
 * layout provê uma instância e as três peças injetam a mesma. É deliberadamente
 * burro — só guarda o que está aberto e o que está recolhido.
 */
@Injectable()
export class DashboardShell {
  /** Sidebar em modo trilho (só ícones). Persistido entre sessões. */
  readonly asideCollapsed = signal(readCollapsed());

  /** Gaveta da sidebar no mobile. */
  readonly drawerOpen = signal(false);

  /** Paleta de comandos (⌘K). */
  readonly commandOpen = signal(false);

  constructor() {
    effect(() => {
      const collapsed = this.asideCollapsed();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(COLLAPSED_KEY, String(collapsed));
      }
    });

    // Enquanto a gaveta ou a paleta estiverem abertas, o body não rola.
    effect(() => {
      const locked = this.drawerOpen() || this.commandOpen();
      if (typeof document !== 'undefined') {
        document.body.style.overflow = locked ? 'hidden' : '';
      }
    });
  }

  toggleAside(): void {
    this.asideCollapsed.update((collapsed) => !collapsed);
  }

  openDrawer(): void {
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  openCommand(): void {
    this.drawerOpen.set(false);
    this.commandOpen.set(true);
  }

  closeCommand(): void {
    this.commandOpen.set(false);
  }

  toggleCommand(): void {
    this.commandOpen() ? this.closeCommand() : this.openCommand();
  }
}
