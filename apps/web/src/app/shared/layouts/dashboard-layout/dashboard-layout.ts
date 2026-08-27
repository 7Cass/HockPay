import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { HlmToaster } from '../../../../../libs/ui/sonner/src';
import { CommandPalette } from './command-palette/command-palette';
import { DashboardShell } from './dashboard-shell';
import { DashboardSidebar } from './sidebar/dashboard-sidebar';
import { DashboardTopbar } from './topbar/dashboard-topbar';

/**
 * Casca do dashboard: sidebar, topbar e a área de conteúdo.
 *
 * Cada tela renderiza só o seu miolo — largura, respiro e rolagem são
 * problema daqui. O `DashboardShell` é provido neste nível, então sidebar,
 * topbar e paleta compartilham a mesma instância.
 */
@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, DashboardSidebar, DashboardTopbar, CommandPalette, HlmToaster],
  providers: [DashboardShell],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class DashboardLayout {
  protected readonly shell = inject(DashboardShell);

  /** ⌘K / Ctrl+K abre a paleta de qualquer lugar do dashboard. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      this.shell.toggleCommand();
    }
  }
}
