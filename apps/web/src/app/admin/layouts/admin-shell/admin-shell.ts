import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut } from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';

import { HlmToaster } from '../../../../../libs/ui/sonner/src';
import { OperatorAuthService } from '../../services/operator-auth.service';
import { ADMIN_NAV, ADMIN_NAV_ICONS } from './admin-nav';

/**
 * A casca do admin.
 *
 * Coluna à esquerda, área de trabalho à direita — e não a barra horizontal que
 * havia antes. A barra economizava altura, que é justamente o que não falta
 * numa tela de tabela; o que falta é um lugar fixo para saber onde se está e
 * quem se é. A coluna dá os dois, e aceita um terceiro destino no dia em que
 * ele existir sem virar um menu "mais".
 *
 * A identidade do operador fica no rodapé da coluna, não no topo: numa mesa
 * onde toda ação entra na trilha assinada, saber com qual crachá se está
 * trabalhando é parte do estado da tela, não um detalhe de perfil.
 */
@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIcon, HlmToaster],
  providers: [provideIcons({ ...ADMIN_NAV_ICONS, lucideLogOut })],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
})
export class AdminShell {
  protected readonly operatorAuth = inject(OperatorAuthService);
  private readonly router = inject(Router);

  protected readonly nav = ADMIN_NAV;
  protected readonly isLeaving = signal(false);

  protected initials(name: string | undefined): string {
    if (!name) return '·';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('');
  }

  protected logout(): void {
    if (this.isLeaving()) return;
    this.isLeaving.set(true);

    this.operatorAuth.logout().subscribe({
      next: () => {
        void this.router.navigate(['/operator/login']);
      },
      error: () => {
        this.isLeaving.set(false);
        toast.error('Não foi possível encerrar a sessão.');
      },
    });
  }
}
