import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { MerchantSession } from '../data/session';
import { MerThemeService } from '../ui';
import { ConsoleRail } from './rail';
import { ConsoleTopbar } from './topbar';

/**
 * A casca do console: trilho à esquerda, área de trabalho à direita.
 *
 * O shell é a **raiz da pele** (`.mer-root`), e é por isso que o atributo do
 * tema mora aqui e não no `<html>`: a mesa divide a origem com o lojista, e o
 * console de um operador aberto na outra aba não clareia porque um lojista
 * preferiu papel.
 *
 * A área de trabalho é a única coisa que rola. O trilho e a barra de cima ficam
 * parados porque nada do que eles mostram depende de onde a página está — e uma
 * navegação que some quando se desce uma lista de mil linhas obriga a subir de
 * volta para trocar de tela.
 */
@Component({
  selector: 'app-console-shell',
  standalone: true,
  imports: [RouterOutlet, ConsoleRail, ConsoleTopbar],
  templateUrl: './console-shell.html',
  styleUrl: './console-shell.css',
  host: {
    class: 'mer-root',
    '[attr.data-mer-theme]': 'theme.resolved()',
  },
})
export class ConsoleShell {
  protected readonly theme = inject(MerThemeService);
  private readonly session = inject(MerchantSession);

  /** A gaveta do celular, onde o trilho não cabe. */
  protected readonly drawerOpen = signal(false);

  constructor() {
    this.session.loadStores();
  }

  protected openDrawer(): void {
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }
}
