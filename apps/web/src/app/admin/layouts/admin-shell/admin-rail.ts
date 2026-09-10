import { Component, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideKeyboard,
  lucideLogOut,
  lucideMoon,
  lucideRows3,
  lucideSearch,
  lucideSun,
} from '@ng-icons/lucide';

import type { CurrentOperator } from '../../services/operator-auth.service';
import { AdmAvatar, AdmBrandMark, AdmKbd, AdmMenu, AdmThemeService } from '../../ui';
import { ADMIN_NAV, ADMIN_NAV_ICONS, type AdminNavItem } from './admin-nav';

/**
 * A coluna da esquerda: marca, busca, destinos e crachá.
 *
 * Escura nos dois temas de propósito. Ela é a única parte da tela que nunca
 * muda de conteúdo, e é ela que dá à mesa uma silhueta que se reconhece de
 * longe — a três metros, dá para ver que a janela aberta é o admin e não o
 * dashboard do lojista, o que numa tela compartilhada em chamado importa mais
 * do que parece.
 *
 * O crachá fica no rodapé, não no topo: numa mesa onde toda ação entra na
 * trilha assinada, saber com qual crachá se está trabalhando é parte do estado
 * da tela, não um detalhe de perfil. Sair mora dentro dele, junto de tema e
 * densidade — é o menu de "quem eu sou aqui", e sair é a última coisa que ele
 * responde.
 */
@Component({
  selector: 'app-admin-rail',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgIcon, AdmAvatar, AdmBrandMark, AdmKbd, AdmMenu],
  providers: [
    provideIcons({
      ...ADMIN_NAV_ICONS,
      lucideKeyboard,
      lucideLogOut,
      lucideMoon,
      lucideRows3,
      lucideSearch,
      lucideSun,
    }),
  ],
  templateUrl: './admin-rail.html',
  styleUrl: './admin-rail.css',
  host: { class: 'rail' },
})
export class AdminRail {
  readonly operator = input<CurrentOperator | null>(null);

  readonly isLeaving = input(false);

  readonly search = output<void>();
  readonly shortcuts = output<void>();
  readonly leave = output<void>();

  protected readonly theme = inject(AdmThemeService);

  protected readonly nav: readonly AdminNavItem[] = ADMIN_NAV;
}
