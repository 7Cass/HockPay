import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideChevronsUpDown, lucideLock } from '@ng-icons/lucide';

import { ApiEnvironment, EnvironmentService } from '../../../../../core/services/environment.service';

/**
 * O seletor de ambiente da sessão.
 *
 * Vive na topbar, e não em Settings, porque saldo, extrato, pagamento, produto
 * e chave mudam de significado com ele: um estado global controlado de uma tela
 * que ninguém visita é um estado global que ninguém sabe que existe.
 *
 * Duas coisas que ele não pode parecer:
 *
 * 1. **LIVE não é um selo de gateway de verdade.** Ele aparece marcado como
 *    simulado aqui, no saldo e no formulário de saque. O projeto inteiro é
 *    construído em não mentir sobre isso.
 * 2. **A porta fechada aparece fechada, não some.** Loja sem habilitação vê a
 *    opção LIVE desabilitada, com o estado atual e o caminho para Settings —
 *    ver a porta é como o lojista descobre que ela existe.
 */
@Component({
  selector: 'app-environment-selector',
  standalone: true,
  imports: [NgIcon, RouterLink],
  providers: [provideIcons({ lucideCheck, lucideChevronsUpDown, lucideLock })],
  templateUrl: './environment-selector.html',
  styleUrl: './environment-selector.css',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
  },
})
export class EnvironmentSelector {
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly environments = inject(EnvironmentService);

  protected readonly open = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly current = computed(() => this.environments.current());
  protected readonly isLive = computed(() => this.environments.isLive());

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  protected close(): void {
    this.open.set(false);
  }

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.open.update((open) => !open);
  }

  protected select(environment: ApiEnvironment): void {
    if (environment === this.current()) {
      this.close();
      return;
    }

    // A tela não decide se LIVE é permitido — ela só evita oferecer uma porta
    // que o use case vai fechar. A regra continua sendo do backend.
    if (environment === 'LIVE' && !this.environments.canSelectLive()) {
      return;
    }

    this.error.set(null);

    this.environments.switchEnvironment(environment).subscribe({
      // Sem `next`: a troca recarrega a página inteira. Nada do ambiente
      // anterior sobrevive, porque nada dele é filtrado — é recarregado.
      error: () => {
        this.close();
        this.error.set('Não foi possível trocar de ambiente. Tente de novo.');
      },
    });
  }
}
