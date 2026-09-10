import { Component, computed, input } from '@angular/core';

/**
 * A barra que ocupa o lugar do que ainda não chegou.
 *
 *   <adm-skeleton width="28%" />
 *   <adm-skeleton width="5.5rem" height="1.375rem" />
 */
@Component({
  selector: 'adm-skeleton',
  standalone: true,
  template: '',
  styleUrl: './skeleton.css',
  host: {
    class: 'adm-skeleton',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    'aria-hidden': 'true',
  },
})
export class AdmSkeleton {
  readonly width = input('100%');
  readonly height = input('0.8rem');
}

/**
 * O esqueleto de uma listagem.
 *
 *   <adm-skeleton-rows [rows]="6" [widths]="['28%', '5.5rem', '4rem']" />
 *
 * Vale mais que um spinner centralizado por um motivo mensurável: a tela não
 * muda de altura quando o dado chega, então o primeiro clique não erra o alvo
 * porque a lista pulou. Os `widths` desenham a forma da linha que vem — três
 * colunas viram três barras, e o olho já sabe onde procurar.
 */
@Component({
  selector: 'adm-skeleton-rows',
  standalone: true,
  imports: [AdmSkeleton],
  template: `
    @for (row of rowList(); track row) {
      <div class="row">
        @for (width of widths(); track $index) {
          <adm-skeleton [width]="width" />
        }
      </div>
    }
  `,
  styleUrl: './skeleton-rows.css',
  host: { role: 'status', 'aria-busy': 'true', 'aria-label': 'Carregando' },
})
export class AdmSkeletonRows {
  readonly rows = input(6);

  readonly widths = input<readonly string[]>(['28%', '5.5rem', '4rem']);

  protected readonly rowList = computed(() =>
    Array.from({ length: Math.max(this.rows(), 0) }, (_, index) => index),
  );
}
