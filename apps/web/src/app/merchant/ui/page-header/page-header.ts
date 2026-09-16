import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * O cabeçalho de uma tela do console.
 *
 *   <mer-page-header heading="Pagamentos" description="Toda cobrança Pix da loja.">
 *     <ng-container pageActions><button merButton>Atualizar</button></ng-container>
 *   </mer-page-header>
 *
 *   <mer-page-header heading="Pagamento" backTo="/dashboard/payments" backLabel="Pagamentos">
 *     <ng-container pageStatus><mer-chip status="CONFIRMED" /></ng-container>
 *   </mer-page-header>
 *
 * A descrição existe para dizer o que a tela **é**, não para repetir o título.
 * Onde não houver uma frase que ensine alguma coisa, é melhor não ter nenhuma.
 */
@Component({
  selector: 'mer-page-header',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (backTo(); as path) {
      <a class="back" [routerLink]="path">
        <span aria-hidden="true">←</span>
        {{ backLabel() || 'Voltar' }}
      </a>
    }

    <div class="row">
      <div class="text">
        <div class="title">
          <h1>{{ heading() }}</h1>
          <ng-content select="[pageStatus]" />
        </div>
        @if (description(); as text) {
          <p class="desc">{{ text }}</p>
        }
      </div>

      <div class="actions">
        <ng-content select="[pageActions]" />
      </div>
    </div>
  `,
  styleUrl: './page-header.css',
  host: { class: 'mer-page-header' },
})
export class MerPageHeader {
  readonly heading = input.required<string>();

  readonly description = input<string>();

  /** A volta, quando a tela é um detalhe. */
  readonly backTo = input<string>();

  readonly backLabel = input<string>();
}
