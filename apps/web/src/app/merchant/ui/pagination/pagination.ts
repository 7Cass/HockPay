import { Component, computed, input, output } from '@angular/core';

/**
 * A paginação de uma lista.
 *
 *   <mer-pagination
 *     [page]="payments.value().page"
 *     [totalPages]="payments.value().totalPages"
 *     [total]="payments.value().total"
 *     [shown]="payments.value().payments.length"
 *     noun="pagamentos"
 *     (goTo)="query.page($event)"
 *   />
 *
 * Mostra a **faixa de itens** (`21–40 de 1.092`) e não o número da página. A
 * pergunta de quem está numa lista de mil linhas é "onde eu estou", e "página 2"
 * não responde: não diz quantas linhas já passaram nem quantas faltam.
 */
@Component({
  selector: 'mer-pagination',
  standalone: true,
  template: `
    <p class="range">
      <span class="mer-num">{{ from() }}–{{ to() }}</span>
      de <span class="mer-num">{{ totalLabel() }}</span> {{ noun() }}
    </p>

    <div class="steps">
      <button
        type="button"
        class="step"
        [disabled]="page() <= 1"
        (click)="goTo.emit(page() - 1)"
        aria-label="Página anterior"
      >
        ←
      </button>
      <span class="of mer-num">{{ page() }} / {{ totalPages() || 1 }}</span>
      <button
        type="button"
        class="step"
        [disabled]="page() >= totalPages()"
        (click)="goTo.emit(page() + 1)"
        aria-label="Próxima página"
      >
        →
      </button>
    </div>
  `,
  styleUrl: './pagination.css',
  host: { class: 'mer-pagination' },
})
export class MerPagination {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly total = input.required<number>();

  /** Quantas linhas esta página trouxe — a última costuma vir incompleta. */
  readonly shown = input.required<number>();

  readonly noun = input('itens');

  readonly goTo = output<number>();

  protected readonly from = computed(() =>
    this.shown() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1,
  );

  protected readonly to = computed(() => (this.page() - 1) * this.pageSize() + this.shown());

  protected readonly totalLabel = computed(() => this.total().toLocaleString('pt-BR'));

  /**
   * O tamanho da página é deduzido, e não recebido: a última página vem
   * incompleta, e usar `shown` como tamanho faria a faixa mentir nela.
   */
  private readonly pageSize = computed(() =>
    this.totalPages() > 1 ? Math.ceil(this.total() / this.totalPages()) : this.shown(),
  );
}
