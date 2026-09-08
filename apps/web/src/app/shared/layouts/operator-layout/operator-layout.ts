import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut } from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';

import { HlmToaster } from '../../../../../libs/ui/sonner/src';
import { OperatorAuthService } from '../../../core/services/operator-auth.service';
import { OPERATOR_NAV, OPERATOR_NAV_ICONS } from './operator-nav';

/**
 * A casca da mesa.
 *
 * Não é o `dashboard-layout` com outro menu: é outra casca, com outra barra e
 * outra identidade visual, porque quem está aqui não é o dono da loja e a tela
 * não deve deixar dúvida sobre isso. Barra em tinta, largura cheia, sem
 * seletor de loja — a mesa não opera uma loja, ela olha várias.
 */
@Component({
  selector: 'app-operator-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIcon, HlmToaster],
  providers: [provideIcons({ ...OPERATOR_NAV_ICONS, lucideLogOut })],
  templateUrl: './operator-layout.html',
  styleUrl: './operator-layout.css',
})
export class OperatorLayout {
  protected readonly operatorAuth = inject(OperatorAuthService);
  private readonly router = inject(Router);

  protected readonly nav = OPERATOR_NAV;
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
