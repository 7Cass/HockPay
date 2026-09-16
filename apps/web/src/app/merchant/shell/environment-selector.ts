import { Component, ElementRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { type ApiEnvironment, MerchantSession } from '../data/session';
import { MerChip } from '../ui';

/**
 * O ambiente da sessão.
 *
 * Vive na barra de cima, e não em Configurações, porque saldo, extrato,
 * pagamento, produto e chave mudam de significado com ele: um estado global
 * controlado de uma tela que ninguém visita é um estado global que ninguém sabe
 * que existe.
 *
 * Duas coisas que ele não pode parecer:
 *
 * 1. **LIVE não é selo de gateway de verdade.** Aparece marcado como simulado
 *    aqui, no saldo e no formulário de saque. O projeto inteiro é construído em
 *    não mentir sobre isso.
 * 2. **A porta fechada aparece fechada, não some.** Loja sem habilitação vê a
 *    opção LIVE desabilitada, com o motivo e o caminho para pedir — ver a porta
 *    é como o lojista descobre que ela existe.
 */
@Component({
  selector: 'app-console-environment',
  standalone: true,
  imports: [RouterLink, MerChip],
  templateUrl: './environment-selector.html',
  styleUrl: './environment-selector.css',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
  },
})
export class ConsoleEnvironment {
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly session = inject(MerchantSession);

  protected readonly open = signal(false);
  protected readonly error = signal('');

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  protected close(): void {
    this.open.set(false);
  }

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.open.update((open) => !open);
  }

  protected select(environment: ApiEnvironment): void {
    this.error.set('');
    this.session.switchEnvironment(environment, () => {
      this.close();
      this.error.set('Não foi possível trocar de ambiente. Tente de novo.');
    });

    if (environment === this.session.environment()) this.close();
  }
}
