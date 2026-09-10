import { Component, booleanAttribute, input, output } from '@angular/core';

import { AdmButton } from '../button/button';

/**
 * O rodapé de uma listagem: onde mora a consciência de posição.
 *
 *   <adm-pagination [label]="range() + ' · página ' + page()"
 *                   [canPrev]="offset() > 0"
 *                   [canNext]="queue.hasMore()"
 *                   (previous)="goToOffset(offset() - limit)"
 *                   (next)="goToOffset(offset() + limit)" />
 *
 * Sem número de página clicável, e é uma escolha: parte da API da mesa pagina
 * por `offset` e não devolve total — a fila é pilha de trabalho, não relatório —,
 * então uma régua de páginas mostraria um "de N" que ninguém sabe. O que dá
 * para dizer com honestidade é onde se está e para onde dá para ir, e é isso
 * que este rodapé diz. Quem tem total passa o total dentro de `label`.
 */
@Component({
  selector: 'adm-pagination',
  standalone: true,
  imports: [AdmButton],
  template: `
    <span class="count">{{ label() }}</span>

    <span class="actions">
      <ng-content />

      <button
        admButton
        type="button"
        variant="quiet"
        size="sm"
        [disabled]="!canPrev()"
        (click)="previous.emit()"
      >
        Anterior
      </button>
      <button
        admButton
        type="button"
        variant="quiet"
        size="sm"
        [disabled]="!canNext()"
        (click)="next.emit()"
      >
        Próxima
      </button>
    </span>
  `,
  styleUrl: './pagination.css',
  host: {
    class: 'adm-pagination',
    '[class.is-bare]': 'bare()',
  },
})
export class AdmPagination {
  /** O que esta página cobre — "21–40 · página 2", "18 de 240". */
  readonly label = input('');

  readonly canPrev = input(false, { transform: booleanAttribute });
  readonly canNext = input(false, { transform: booleanAttribute });

  /** Sem a faixa de fundo, para quando o rodapé não fecha um painel. */
  readonly bare = input(false, { transform: booleanAttribute });

  readonly previous = output<void>();
  readonly next = output<void>();
}
